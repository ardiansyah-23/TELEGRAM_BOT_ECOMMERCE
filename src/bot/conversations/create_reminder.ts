import { type Conversation } from '@grammyjs/conversations';
import { type MyContext } from '../types';
import { jobService } from '../../services/jobs/job.service';

export async function createReminderConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext
) {
  await ctx.reply('⏰ Silakan ketik pesan reminder yang ingin disimpan:\n\n(Ketik /cancel untuk membatalkan)');
  
  const msgCtx = await conversation.waitFor('message:text');
  if (msgCtx.message.text === '/cancel') {
    await ctx.reply('❌ Pembuatan reminder dibatalkan.');
    return;
  }
  
  const message = msgCtx.message.text;

  await ctx.reply('📅 Kapan reminder ini harus dikirim?\nFormat: YYYY-MM-DD HH:MM\nContoh: 2026-08-20 10:30\n(Gunakan zona waktu UTC atau waktu lokal Anda jika timezone sudah diset di Pengaturan)');
  
  const timeCtx = await conversation.waitFor('message:text');
  if (timeCtx.message.text === '/cancel') {
    await ctx.reply('❌ Pembuatan reminder dibatalkan.');
    return;
  }

  const timeStr = timeCtx.message.text;
  const runAt = new Date(timeStr);

  if (isNaN(runAt.getTime())) {
    await ctx.reply('❌ Format waktu tidak valid. Silakan ulangi proses dengan format yang benar.');
    return;
  }

  if (runAt.getTime() <= Date.now()) {
    await ctx.reply('❌ Waktu reminder tidak boleh di masa lalu. Silakan ulangi.');
    return;
  }

  // Ensure ctx.from exists
  if (!ctx.from?.id) return;

  const payload = {
    telegram_id: ctx.from.id,
    message: message
  };

  const job = await conversation.external(() => 
    jobService.createJob('reminder', runAt, payload)
  );

  if (job) {
    await ctx.reply(`✅ Reminder berhasil dijadwalkan pada:\n🗓 ${runAt.toLocaleString('id-ID')}`);
  } else {
    await ctx.reply('❌ Gagal membuat reminder. Silakan coba lagi nanti.');
  }
}
