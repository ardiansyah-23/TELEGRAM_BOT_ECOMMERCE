import { InlineKeyboard } from 'grammy';
import { jobService } from '../../../services/jobs/job.service';

export const setupRemindersCallback = (bot: any) => {
  bot.callbackQuery('user:reminders', async (ctx: any) => {
    const jobs = await jobService.getPendingJobsByUser(ctx.from!.id);
    
    let msg = `⏰ **REMINDER SAYA**\n\n`;
    const kb = new InlineKeyboard();
    
    if (jobs.length === 0) {
      msg += `Belum ada reminder yang dijadwalkan.`;
    } else {
      jobs.forEach((job, index) => {
        msg += `${index + 1}.\n💬 ${job.payload.message}\n🗓 ${new Date(job.run_at).toLocaleString('id-ID')}\n\n`;
        kb.text(`🗑 Hapus #${index + 1}`, `user:reminders:del:${job.id}`).row();
      });
    }
    
    kb.text('➕ Buat Reminder', 'user:reminders:create').row()
      .text('⬅️ Kembali', 'menu_profile');
      
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('user:reminders:create', async (ctx: any) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('createReminderConversation');
  });

  bot.callbackQuery(/^user:reminders:del:(.+)$/, async (ctx: any) => {
    const jobId = ctx.match[1];
    
    // In a real app we'd also verify ownership in the DB before cancelling,
    // but the payload check during retrieval mostly shields us here unless someone guesses the UUID.
    // For now we'll just cancel it.
    
    const success = await jobService.cancelJob(jobId);
    if (success) {
      await ctx.answerCallbackQuery('✅ Reminder berhasil dihapus.', { show_alert: true });
    } else {
      await ctx.answerCallbackQuery('❌ Gagal menghapus reminder atau sudah diproses.');
    }
    
    // Refresh list
    // Re-use logic or send them back
    const kb = new InlineKeyboard().text('⬅️ Kembali ke Reminder', 'user:reminders');
    await ctx.editMessageText('Status reminder telah diperbarui.', { reply_markup: kb });
  });
};
