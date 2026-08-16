import { Bot, InlineKeyboard } from 'grammy';
import { requireAdmin } from '../../middleware/admin';
import { supabase } from '../../../database/client';
import type { MyContext } from '../../types';

export const setupBanCallback = (bot: any) => {
  bot.callbackQuery(/admin:ban:(\d+)/, requireAdmin as any, async (ctx: any) => {
    const telegram_id = parseInt(ctx.match[1]);
    
    if (ctx.from!.id === telegram_id) {
      await ctx.answerCallbackQuery({ text: '❌ Kamu tidak dapat membanned akun admin yang sedang digunakan.', show_alert: true });
      return;
    }

    await supabase.from('users').update({ is_active: false }).eq('telegram_id', telegram_id);
    
    // Refresh user detail view
    const kb = new InlineKeyboard().text('✅ Unban', `admin:unban:${telegram_id}`).row().text('⬅️ Kembali', 'admin:users:1');
    await ctx.editMessageReplyMarkup({ reply_markup: kb });
    await ctx.answerCallbackQuery('User berhasil diblokir.');
  });

  bot.callbackQuery(/admin:unban:(\d+)/, requireAdmin as any, async (ctx: any) => {
    const telegram_id = parseInt(ctx.match[1]);
    
    await supabase.from('users').update({ is_active: true }).eq('telegram_id', telegram_id);
    
    // Refresh user detail view
    const kb = new InlineKeyboard().text('🚫 Ban', `admin:ban:${telegram_id}`).row().text('⬅️ Kembali', 'admin:users:1');
    await ctx.editMessageReplyMarkup({ reply_markup: kb });
    await ctx.answerCallbackQuery('User berhasil diaktifkan kembali.');
  });
};
