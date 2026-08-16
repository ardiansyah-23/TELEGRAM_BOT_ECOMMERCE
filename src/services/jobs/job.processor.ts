import { jobService } from './job.service';
import type { ScheduledJob } from '../../database/types';
import { bot } from '../../bot';
import { campaignService } from '../notification/campaign.service';

export class JobProcessor {
  async processBatch(limit: number = 10) {
    const jobs = await jobService.claimJobs(limit);
    if (jobs.length === 0) return 0;
    
    let processed = 0;
    for (const job of jobs) {
      try {
        await this.processJob(job);
        await jobService.completeJob(job.id);
        processed++;
      } catch (e: any) {
        console.error(`Error processing job ${job.id}:`, e);
        await jobService.failJob(job.id, e.message || 'Unknown error', job.attempts, job.max_attempts);
      }
    }
    return processed;
  }

  private async processJob(job: ScheduledJob) {
    switch (job.type) {
      case 'reminder':
        await this.processReminder(job.payload);
        break;
      case 'scheduled_message':
      case 'broadcast':
        await this.processBroadcast(job.payload);
        break;
      case 'membership_expiration':
        await this.processMembershipExpiration(job.payload);
        break;
      case 'payment_expiration':
        await this.processPaymentExpiration(job.payload);
        break;
      case 'order_notification':
        await this.processOrderNotification(job.payload);
        break;
      case 'campaign':
        await this.processCampaign(job.payload, job.id);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  private async processReminder(payload: any) {
    const { telegram_id, message } = payload;
    if (!telegram_id || !message) throw new Error('Invalid reminder payload');
    
    await bot.api.sendMessage(telegram_id, `⏰ **REMINDER**\n\n${message}`, { parse_mode: 'Markdown' });
  }

  private async processBroadcast(payload: any) {
    const { telegram_ids, message } = payload;
    if (!telegram_ids || !Array.isArray(telegram_ids) || !message) throw new Error('Invalid broadcast payload');
    
    let sent = 0;
    for (const id of telegram_ids) {
      try {
        await bot.api.sendMessage(id, message, { parse_mode: 'HTML' });
        sent++;
        // Very basic throttling
        await new Promise(r => setTimeout(r, 50)); 
      } catch (e) {
        console.error(`Failed to broadcast to ${id}`, e);
      }
    }
    console.log(`Broadcast completed. Sent: ${sent}/${telegram_ids.length}`);
  }

  private async processMembershipExpiration(payload: any) {
    const { telegram_id, days_left } = payload;
    let msg = '';
    if (days_left === 0) {
      msg = `💎 Membership Premium Anda telah berakhir hari ini.`;
    } else {
      msg = `⏳ Membership Premium Anda akan berakhir dalam ${days_left} hari.`;
    }
    await bot.api.sendMessage(telegram_id, msg);
  }

  private async processPaymentExpiration(payload: any) {
    const { telegram_id, order_number } = payload;
    await bot.api.sendMessage(telegram_id, `❌ Waktu pembayaran untuk pesanan ${order_number} telah habis.`);
  }

  private async processOrderNotification(payload: any) {
    const { telegram_id, order_number, status } = payload;
    await bot.api.sendMessage(telegram_id, `📦 Pesanan ${order_number} Anda kini berstatus: ${status}`);
  }

  private async processCampaign(payload: any, job_id: string) {
    const { campaign_id } = payload;
    
    // First invocation: Start processing and generate recipients
    const campaign = await campaignService.getCampaign(campaign_id);
    if (campaign && campaign.status === 'scheduled') {
      await campaignService.startCampaignProcessing(campaign_id);
    }
    
    // Process a batch
    const result = await campaignService.processCampaignBatch(campaign_id, 30);
    
    if (!result.isDone) {
      // Throw an error intentionally so the job stays in the queue and is retried 
      // (This relies on backoff. Alternatively, create a NEW pending job and complete this one).
      // For cleaner batching, we will create a new job to continue immediately or let Vercel hit it next time.
      // Wait, throw is bad for attempts. Instead, complete this job and spawn a clone if not done.
      // But jobService.failJob increments attempts.
      
      // Let's spawn a clone job to continue processing
      await jobService.createJob('campaign', new Date(), payload);
    }
  }
}

export const jobProcessor = new JobProcessor();
