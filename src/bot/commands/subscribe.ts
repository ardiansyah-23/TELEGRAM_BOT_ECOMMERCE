import { notificationService } from '../../services/notification/notification.service';
import type { MyContext } from '../types';

export const setupSubscribeCommands = (bot: any) => {
  bot.command('subscribe', async (ctx: MyContext) => {
    if (!ctx.from) return;
    await notificationService.updatePreferences(ctx.from.id, { campaign_notifications: true });
    await ctx.reply('✅ Anda telah **SUBSCRIBE** ke pesan marketing/campaign dari kami. Terima kasih!', { parse_mode: 'Markdown' });
  });

  bot.command('unsubscribe', async (ctx: MyContext) => {
    if (!ctx.from) return;
    await notificationService.updatePreferences(ctx.from.id, { campaign_notifications: false });
    await ctx.reply('❌ Anda telah **UNSUBSCRIBE** dari pesan marketing/campaign.\n\nAnda tidak akan menerima broadcast promo lagi, namun tetap akan menerima notifikasi transaksi penting (Pesanan, Pembayaran).', { parse_mode: 'Markdown' });
  });
};
