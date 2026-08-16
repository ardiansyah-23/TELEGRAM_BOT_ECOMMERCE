import { supabase } from '../database/client';
import { bot } from '../bot';
// If we had a specific Midtrans ping method we'd use it, otherwise we assume degraded if missing
import { paymentService } from './payment/payment.service';

export type ComponentStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheckResult {
  component: string;
  status: ComponentStatus;
  message?: string;
  timestamp: string;
}

export class HealthService {
  
  async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Simple lightweight query
      const { data, error } = await supabase.from('users').select('id').limit(1);
      if (error) throw error;
      
      const duration = Date.now() - start;
      let status: ComponentStatus = 'healthy';
      if (duration > 1000) status = 'degraded'; // if > 1s, degraded

      await this.updateStatus('database', status);
      return { component: 'database', status, timestamp: new Date().toISOString() };
    } catch (e: any) {
      await this.updateStatus('database', 'unhealthy');
      return { component: 'database', status: 'unhealthy', message: e.message, timestamp: new Date().toISOString() };
    }
  }

  async checkTelegram(): Promise<HealthCheckResult> {
    try {
      // getMe is a lightweight check
      await bot.api.getMe();
      await this.updateStatus('telegram', 'healthy');
      return { component: 'telegram', status: 'healthy', timestamp: new Date().toISOString() };
    } catch (e: any) {
      await this.updateStatus('telegram', 'unhealthy');
      return { component: 'telegram', status: 'unhealthy', message: e.message, timestamp: new Date().toISOString() };
    }
  }

  async checkPayment(): Promise<HealthCheckResult> {
    // Payment API might not have a /health endpoint we can hit without side effects.
    // In this case, we return 'unknown' or 'healthy' if we assume it's up.
    // Midtrans API doesn't have a public health check endpoint that requires no auth / no transaction.
    return { component: 'payment', status: 'unknown', message: 'No official health endpoint', timestamp: new Date().toISOString() };
  }

  async getCronHealth(): Promise<HealthCheckResult> {
    try {
      const { data } = await supabase.from('system_health').select('*').eq('component', 'cron').single();
      if (!data) return { component: 'cron', status: 'unknown', timestamp: new Date().toISOString() };

      const lastSuccess = new Date(data.last_success_at).getTime();
      const now = Date.now();
      
      // If cron hasn't run in the last 15 minutes, it's degraded/unhealthy
      // (assuming cron is configured for every 5 mins in vercel.json)
      let status: ComponentStatus = 'healthy';
      if (now - lastSuccess > 15 * 60 * 1000) {
        status = 'unhealthy';
      } else if (now - lastSuccess > 6 * 60 * 1000) {
        status = 'degraded';
      }

      return { component: 'cron', status, timestamp: new Date().toISOString() };
    } catch (e) {
      return { component: 'cron', status: 'unknown', timestamp: new Date().toISOString() };
    }
  }

  async recordCronRun(success: boolean) {
    const component = 'cron';
    const now = new Date().toISOString();
    
    if (success) {
      await supabase.from('system_health').upsert({
        component,
        last_success_at: now,
        status: 'healthy',
        updated_at: now
      });
    } else {
      await supabase.from('system_health').upsert({
        component,
        last_failure_at: now,
        status: 'unhealthy',
        updated_at: now
      });
    }
  }

  private async updateStatus(component: string, status: string) {
    try {
      const now = new Date().toISOString();
      const updateData: any = { component, status, updated_at: now };
      if (status === 'healthy') updateData.last_success_at = now;
      else if (status === 'unhealthy') updateData.last_failure_at = now;
      
      await supabase.from('system_health').upsert(updateData);
    } catch (e) {
      // Ignore inner error
    }
  }

  async checkAll() {
    const db = await this.checkDatabase();
    // To prevent spamming Telegram on every internal check, we might want to cache Telegram status
    // But for a dedicated admin endpoint check, it's fine.
    const tg = await this.checkTelegram();
    const pay = await this.checkPayment();
    const cron = await this.getCronHealth();

    return [db, tg, pay, cron];
  }
}

export const healthService = new HealthService();
