import { supabase } from '../../database/client';
import type { Campaign, CampaignRecipient } from '../../database/types';
import { segmentService } from './segment.service';
import { templateService } from './template.service';
import { notificationService } from './notification.service';
import { jobService } from '../jobs/job.service';

export class CampaignService {
  async getCampaign(id: string): Promise<Campaign | null> {
    const { data, error } = await supabase.from('campaigns').select('*').eq('id', id).single();
    if (error) return null;
    return data as Campaign;
  }

  async createCampaign(name: string, template_id: string, segment_id: string, scheduled_at: Date | null = null): Promise<Campaign | null> {
    const total_target = await segmentService.getTargetCount(segment_id);
    
    const { data, error } = await supabase.from('campaigns').insert([{
      name,
      template_id,
      segment_id,
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at?.toISOString(),
      total_target
    }]).select().single();
    
    if (error || !data) return null;
    
    // If scheduled, create a job for it
    if (scheduled_at) {
      await jobService.createJob('campaign', scheduled_at, { campaign_id: data.id }, `campaign_${data.id}`);
    }
    
    return data as Campaign;
  }

  async startCampaignProcessing(campaign_id: string): Promise<boolean> {
    // Lock campaign
    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', campaign_id)
      .in('status', ['draft', 'scheduled'])
      .select().single();
      
    if (error || !data) return false;
    
    // Generate recipients. We assume for now we can fetch all target users and insert them into recipients.
    // For very large datasets, this step should also be paginated, but for Telegram bot scale 
    // retrieving e.g. 100k integers and doing bulk insert is well within serverless bounds if done carefully.
    const telegramIds = await segmentService.getTargetUsers(data.segment_id, 100000, 0);
    
    if (telegramIds.length > 0) {
      const recipientInserts = telegramIds.map(id => ({
        campaign_id: data.id,
        telegram_id: id,
        status: 'pending'
      }));
      
      // Batch insert in chunks of 5000 to be safe with Supabase limits
      for (let i = 0; i < recipientInserts.length; i += 5000) {
        await supabase.from('campaign_recipients').insert(recipientInserts.slice(i, i + 5000));
      }
    }
    
    return true;
  }

  async processCampaignBatch(campaign_id: string, batchSize: number = 25): Promise<{ processed: number, isDone: boolean }> {
    const campaign = await this.getCampaign(campaign_id);
    if (!campaign || campaign.status !== 'processing') return { processed: 0, isDone: true };
    
    const template = await templateService.getTemplate(campaign.template_id);
    if (!template) {
      await supabase.from('campaigns').update({ status: 'failed' }).eq('id', campaign_id);
      return { processed: 0, isDone: true };
    }

    // Get pending recipients
    const { data: recipients, error } = await supabase
      .from('campaign_recipients')
      .select('*')
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending')
      .limit(batchSize);
      
    if (error || !recipients || recipients.length === 0) {
      // Done processing
      await supabase.from('campaigns').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', campaign_id);
      return { processed: 0, isDone: true };
    }
    
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    
    for (const r of recipients) {
      const recipient = r as CampaignRecipient;
      
      // Render text (In a real system, you'd fetch user data like name here if template requires variables)
      const text = templateService.renderTemplate(template.content, {});
      
      // Send via notification service (respects opt-out)
      const success = await notificationService.sendNotification(recipient.telegram_id, 'campaign_notifications', text);
      
      let newStatus = success ? 'sent' : 'skipped'; // If it returns false, it could be opt-out or block
      if (success) sentCount++;
      else skippedCount++;
      
      await supabase.from('campaign_recipients').update({
        status: newStatus,
        sent_at: success ? new Date().toISOString() : null,
        attempts: recipient.attempts + 1
      }).eq('id', recipient.id);
      
      // Basic rate limiting protection
      await new Promise(resolve => setTimeout(resolve, 35));
    }
    
    // Update campaign stats
    await supabase.rpc('update_campaign_stats', { 
      c_id: campaign_id, 
      added_sent: sentCount, 
      added_failed: failedCount, 
      added_skipped: skippedCount 
    });
    
    return { processed: recipients.length, isDone: false };
  }
}

export const campaignService = new CampaignService();
