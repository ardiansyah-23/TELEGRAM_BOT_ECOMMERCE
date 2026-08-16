import { Bot, InlineKeyboard } from 'grammy';
import { getUserByTelegramId } from '../../database/users';

export const setupMenuCallbacks = (bot: Bot) => {
  bot.callbackQuery('menu_profile', async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from || !ctx.from.id) return;
    
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user) {
      await ctx.editMessageText('Profile tidak ditemukan. Silakan ketik /start untuk mendaftar.');
      return;
    }

    const profileMsg = `👤 Profil\n
Nama: ${user.first_name || '-'} ${user.last_name || ''}
Username: ${user.username ? '@' + user.username : '-'}
Telegram ID: ${user.telegram_id}
Role: ${user.is_admin ? 'Admin' : 'User'}
Terdaftar: ${new Date(user.created_at).toLocaleString('id-ID')}`;

    const kb = new InlineKeyboard()
      .text('💎 Membership', 'user:membership').row();
    if (user.is_admin) {
      kb.text('👑 Admin Panel', 'admin:menu').row();
    }
    kb.text('⏰ Reminders Saya', 'user:reminders')
      .text('🔔 Notifikasi', 'user:preferences').row()
      .text('⬅️ Kembali', 'menu_main');

    await ctx.editMessageText(profileMsg, { reply_markup: kb });
  });

  bot.callbackQuery('menu_settings', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('Pengaturan bot (dalam pengembangan).');
  });

  bot.callbackQuery('menu_help', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('Bantuan: Gunakan /start untuk memulai dan /help untuk melihat daftar perintah.');
  });

  bot.callbackQuery('menu_about', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('Tentang: Bot ini adalah fondasi bot modular menggunakan grammY dan Vercel.');
  });
};
