import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { supabase } from '../../database/client';
import type { MyContext, MyConversation } from '../types';

export async function searchConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('Ketikkan username (tanpa @) atau Telegram ID user yang ingin dicari.\nKirim /cancel untuk membatalkan.');

  const { message } = await conversation.wait();

  if (message?.text === '/cancel') {
    await ctx.reply('Pencarian dibatalkan.');
    return;
  }

  if (!message?.text) {
    await ctx.reply('Input tidak valid. Batal.');
    return;
  }

  const query = message.text.trim();
  const isNumeric = /^\d+$/.test(query);

  let userQuery = supabase.from('users').select('*');
  
  if (isNumeric) {
    userQuery = userQuery.eq('telegram_id', parseInt(query));
  } else {
    // ILIKE for case insensitive
    userQuery = userQuery.ilike('username', `%${query}%`);
  }

  const { data: users } = await userQuery.limit(5);

  if (!users || users.length === 0) {
    await ctx.reply('❌ User tidak ditemukan.');
    return;
  }

  let msg = `🔎 HASIL PENCARIAN\n\n`;
  const kb = new InlineKeyboard();

  users.forEach((u: any, i: number) => {
    msg += `${i + 1}. ${u.first_name || '-'} ${u.username ? '(@' + u.username + ')' : ''} [${u.telegram_id}]\n`;
    kb.text(`Detail #${i + 1}`, `admin:userdetail:${u.telegram_id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });

  kb.row();
  kb.text('⬅️ Kembali ke Users', 'admin:users:1');

  await ctx.reply(msg, { reply_markup: kb });
}
