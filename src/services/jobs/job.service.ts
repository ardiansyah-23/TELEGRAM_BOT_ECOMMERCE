import { supabase } from '../../database/client';
import type { ScheduledJob } from '../../database/types';

export class JobService {
  async createJob(
    type: ScheduledJob['type'],
    run_at: Date,
    payload: any,
    idempotency_key: string | null = null,
    max_attempts: number = 3
  ): Promise<ScheduledJob | null> {
    try {
      const { data, error } = await supabase
        .from('scheduled_jobs')
        .insert([{
          type,
          run_at: run_at.toISOString(),
          payload,
          max_attempts,
          idempotency_key
        }])
        .select()
        .single();
        
      if (error) {
        if (error.code === '23505') { // unique violation on idempotency_key
          return null;
        }
        console.error('Error creating job:', error);
        return null;
      }
      return data as ScheduledJob;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  async claimJobs(limit: number = 10): Promise<ScheduledJob[]> {
    const { data, error } = await supabase.rpc('claim_scheduled_jobs', { p_limit: limit });
    if (error) {
      console.error('Error claiming jobs:', error);
      return [];
    }
    return (data || []) as ScheduledJob[];
  }

  async completeJob(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('scheduled_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', id);
      
    return !error;
  }

  async failJob(id: string, errorMessage: string, currentAttempts: number, maxAttempts: number): Promise<boolean> {
    const isPermanent = currentAttempts >= maxAttempts;
    
    // Simple backoff: run again in (attempts * 5) minutes
    const nextRun = new Date();
    nextRun.setMinutes(nextRun.getMinutes() + (currentAttempts * 5));
    
    const updateData: any = {
      status: isPermanent ? 'failed' : 'pending',
      last_error: errorMessage
    };
    
    if (!isPermanent) {
      updateData.run_at = nextRun.toISOString();
    }
    
    const { error } = await supabase
      .from('scheduled_jobs')
      .update(updateData)
      .eq('id', id);
      
    return !error;
  }

  async cancelJob(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('scheduled_jobs')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending');
      
    return !error;
  }

  async retryJob(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('scheduled_jobs')
      .update({ status: 'pending', run_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'failed');
      
    return !error;
  }

  async getPendingJobsByUser(telegram_id: number): Promise<ScheduledJob[]> {
    const { data, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('type', 'reminder')
      .eq('status', 'pending')
      .contains('payload', { telegram_id })
      .order('run_at', { ascending: true });
      
    if (error) return [];
    return data as ScheduledJob[];
  }
}

export const jobService = new JobService();
