import { Bot, InlineKeyboard } from 'grammy';
import { getMainMenu } from '../keyboards/menu';
import { createReferral, getUserByReferralCode } from '../../database/referrals';

export const setupStartCommand = (bot: Bot) => {
  bot.command('start', async (ctx: any) => {
    // Check deep link payload for referral
    const payload = ctx.match;
    if (payload && payload.startsWith('REF-')) {
      const referrerId = await getUserByReferralCode(payload);
      if (referrerId && referrerId !== ctx.from?.id) {
        // We attempt to create referral (it ignores if already referred)
        await createReferral(referrerId, ctx.from!.id);
      }
    }
    const welcomeMessage = `Halo ${ctx.from?.first_name || 'Pengguna'}! 👋\n\nSelamat datang di Bot Telegram. Gunakan menu di bawah untuk navigasi.`;
    
    const webAppUrl = process.env.WEB_APP_URL || 'https://telegram-bot-ecommerce-v2.vercel.app';
    const keyboard = new InlineKeyboard()
      .webApp('🌐 Buka Aplikasi', webAppUrl)
      .row()
      .text('🛍 Belanja', 'shop:categories')
      .text('🛒 Keranjang', 'shop:cart')
      .row()
      .text('👤 Profil & Membership', 'menu_profile');

    await ctx.reply(welcomeMessage, {
      reply_markup: keyboard,
    });
  });
};
