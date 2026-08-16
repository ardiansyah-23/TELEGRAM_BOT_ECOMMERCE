import { Bot } from 'grammy';
import { getUserByTelegramId } from '../../database/users';

export const setupProfileCommand = (bot: Bot) => {
  bot.command('profile', async (ctx) => {
    if (!ctx.from || !ctx.from.id) return;
    
    const user = await getUserByTelegramId(ctx.from.id);
    
    if (!user) {
      await ctx.reply('Profile tidak ditemukan. Silakan ketik /start untuk mendaftar.');
      return;
    }

    const profileMsg = `👤 Profil

Nama: ${user.first_name || '-'} ${user.last_name || ''}
Username: ${user.username ? '@' + user.username : '-'}
Telegram ID: ${user.telegram_id}
Role: ${user.is_admin ? 'Admin' : 'User'}
Terdaftar: ${new Date(user.created_at).toLocaleString('id-ID')}
Terakhir aktif: ${new Date(user.last_seen_at).toLocaleString('id-ID')}`;

    await ctx.reply(profileMsg);
  });
};
