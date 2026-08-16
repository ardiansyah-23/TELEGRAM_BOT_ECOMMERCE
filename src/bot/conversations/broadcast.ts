import { Conversation } from '@grammyjs/conversations';
import { Context, InlineKeyboard } from 'grammy';
import { supabase } from '../../database/client';
import { createBroadcast, updateBroadcastStatus } from '../../database/broadcasts';

import type { MyContext } from '../types';
export type MyConversation = Conversation<MyContext>;

export async function broadcastConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('Kirimkan pesan yang ingin Anda broadcast (Teks/Foto/Video/Dokumen). \nKirim /cancel untuk membatalkan.');

  const { message } = await conversation.wait();

  if (message?.text === '/cancel') {
    await ctx.reply('Broadcast dibatalkan.');
    return;
  }

  if (!message) {
    await ctx.reply('Tipe pesan tidak didukung. Batal.');
    return;
  }

  // Get active users count
  const { count } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  
  const totalTarget = count || 0;

  if (totalTarget === 0) {
    await ctx.reply('Tidak ada user aktif untuk dibroadcast.');
    return;
  }

  // Show confirmation
  const confirmKeyboard = new InlineKeyboard()
    .text('✅ KIRIM', 'broadcast:confirm')
    .text('❌ BATAL', 'broadcast:cancel');

  await ctx.reply(
    `⚠️ KONFIRMASI\n\nPesan akan dikirim kepada:\n${totalTarget} user aktif\n\nApakah kamu yakin?`,
    { reply_markup: confirmKeyboard }
  );

  const cb = await conversation.waitForCallbackQuery(['broadcast:confirm', 'broadcast:cancel']);
  await cb.answerCallbackQuery();

  if (cb.callbackQuery.data === 'broadcast:cancel') {
    await cb.editMessageText('Broadcast dibatalkan.');
    return;
  }

  await cb.editMessageText('Memulai broadcast... (Proses mungkin memakan waktu bergantung batas Telegram/Vercel)');

  // Determine type
  let messageType = 'text';
  if (message.photo) messageType = 'photo';
  else if (message.video) messageType = 'video';
  else if (message.document) messageType = 'document';

  // Save to DB
  const broadcast = await createBroadcast(ctx.from!.id, messageType, 'all_active', totalTarget);

  // Fetch all active users
  const { data: users } = await supabase
    .from('users')
    .select('telegram_id')
    .eq('is_active', true);

  if (!users) {
    await ctx.reply('Gagal mengambil daftar user.');
    return;
  }

  let sent = 0;
  let failed = 0;

  // WARNING: Synchronous loop inside serverless function. 
  // For large numbers, this WILL timeout on Vercel. 
  // It is explicitly noted in README limitations.
  for (const user of users) {
    try {
      await ctx.api.copyMessage(user.telegram_id, ctx.chat!.id, message.message_id);
      sent++;
    } catch (e) {
      failed++;
    }
  }

  // Update DB
  if (broadcast) {
    await updateBroadcastStatus(broadcast.id, {
      status: 'completed',
      total_sent: sent,
      total_failed: failed,
      completed_at: new Date().toISOString()
    });
  }

  await ctx.reply(`📢 Broadcast selesai!\n\nBerhasil: ${sent}\nGagal: ${failed}`);
}
