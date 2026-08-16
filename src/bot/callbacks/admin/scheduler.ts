import { InlineKeyboard } from 'grammy';
import { supabase } from '../../../database/client';
import { jobService } from '../../../services/jobs/job.service';

export const setupAdminSchedulerCallback = (bot: any) => {
  bot.callbackQuery('admin:scheduler', async (ctx: any) => {
    // Get job stats
    const { data: stats } = await supabase
      .from('scheduled_jobs')
      .select('status');
      
    let pending = 0, processing = 0, completed = 0, failed = 0, cancelled = 0;
    stats?.forEach(s => {
      if (s.status === 'pending') pending++;
      else if (s.status === 'processing') processing++;
      else if (s.status === 'completed') completed++;
      else if (s.status === 'failed') failed++;
      else if (s.status === 'cancelled') cancelled++;
    });

    let msg = `⏰ **ADMIN SCHEDULER**\n\n`;
    msg += `Pending: ${pending}\n`;
    msg += `Processing: ${processing}\n`;
    msg += `Completed: ${completed}\n`;
    msg += `Failed: ${failed}\n`;
    msg += `Cancelled: ${cancelled}\n\n`;
    
    const kb = new InlineKeyboard()
      .text('📋 Failed Jobs', 'admin:scheduler:failed').row()
      .text('⬅️ Kembali', 'admin:menu');
      
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('admin:scheduler:failed', async (ctx: any) => {
    const { data: failedJobs } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('status', 'failed')
      .order('run_at', { ascending: false })
      .limit(5); // Just limit to 5 for now
      
    let msg = `❌ **FAILED JOBS (Top 5)**\n\n`;
    const kb = new InlineKeyboard();
    
    if (!failedJobs || failedJobs.length === 0) {
      msg += `Tidak ada job yang failed.`;
    } else {
      failedJobs.forEach((job, idx) => {
        msg += `${idx + 1}. [${job.type}] ID: ${job.id.substring(0, 8)}...\nError: ${job.last_error}\n\n`;
        kb.text(`🔄 Retry #${idx + 1}`, `admin:scheduler:retry:${job.id}`).row();
      });
    }
    
    kb.text('⬅️ Kembali', 'admin:scheduler');
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^admin:scheduler:retry:(.+)$/, async (ctx: any) => {
    const jobId = ctx.match[1];
    const success = await jobService.retryJob(jobId);
    
    if (success) {
      await ctx.answerCallbackQuery('✅ Job berhasil di-retry (kembali pending).');
    } else {
      await ctx.answerCallbackQuery('❌ Gagal retry job.');
    }
    
    // Send back to failed list
    const kb = new InlineKeyboard().text('⬅️ Refresh Failed', 'admin:scheduler:failed');
    await ctx.editMessageText('Status job telah diperbarui.', { reply_markup: kb });
  });
};
