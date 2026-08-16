import { InlineKeyboard } from 'grammy';
import { notificationService } from '../../../services/notification/notification.service';

export const setupPreferencesCallback = (bot: any) => {
  bot.callbackQuery('user:preferences', async (ctx: any) => {
    const prefs = await notificationService.getPreferences(ctx.from!.id);
    
    const kb = new InlineKeyboard()
      .text(`📦 Pesanan: ${prefs.order_notifications ? '✅ ON' : '❌ OFF'}`, `user:pref:order:${!prefs.order_notifications}`).row()
      .text(`💳 Pembayaran: ${prefs.payment_notifications ? '✅ ON' : '❌ OFF'}`, `user:pref:payment:${!prefs.payment_notifications}`).row()
      .text(`💎 Membership: ${prefs.membership_notifications ? '✅ ON' : '❌ OFF'}`, `user:pref:membership:${!prefs.membership_notifications}`).row()
      .text(`🎁 Reward: ${prefs.reward_notifications ? '✅ ON' : '❌ OFF'}`, `user:pref:reward:${!prefs.reward_notifications}`).row()
      .text(`📢 Campaign: ${prefs.campaign_notifications ? '✅ ON' : '❌ OFF'}`, `user:pref:campaign:${!prefs.campaign_notifications}`).row()
      .text('⬅️ Kembali', 'menu_profile');
      
    const msg = `🔔 **PENGATURAN NOTIFIKASI**\n\nSilakan aktifkan atau nonaktifkan jenis notifikasi yang ingin Anda terima:`;
    
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^user:pref:(order|payment|membership|reward|campaign):(.+)$/, async (ctx: any) => {
    const fieldType = ctx.match[1];
    const targetState = ctx.match[2] === 'true';
    
    const updatePayload: any = {};
    updatePayload[`${fieldType}_notifications`] = targetState;
    
    await notificationService.updatePreferences(ctx.from!.id, updatePayload);
    await ctx.answerCallbackQuery('✅ Preferensi disimpan.');
    
    // Refresh preferences view
    const prefs = await notificationService.getPreferences(ctx.from!.id);
    const kb = new InlineKeyboard()
      .text(`📦 Pesanan: ${prefs.order_notifications ? '✅ ON' : '❌ OFF'}`, `user:pref:order:${!prefs.order_notifications}`).row()
      .text(`💳 Pembayaran: ${prefs.payment_notifications ? '✅ ON' : '❌ OFF'}`, `user:pref:payment:${!prefs.payment_notifications}`).row()
      .text(`💎 Membership: ${prefs.membership_notifications ? '✅ ON' : '❌ OFF'}`, `user:pref:membership:${!prefs.membership_notifications}`).row()
      .text(`🎁 Reward: ${prefs.reward_notifications ? '✅ ON' : '❌ OFF'}`, `user:pref:reward:${!prefs.reward_notifications}`).row()
      .text(`📢 Campaign: ${prefs.campaign_notifications ? '✅ ON' : '❌ OFF'}`, `user:pref:campaign:${!prefs.campaign_notifications}`).row()
      .text('⬅️ Kembali', 'menu_profile');
      
    await ctx.editMessageReplyMarkup({ reply_markup: kb });
  });
};
