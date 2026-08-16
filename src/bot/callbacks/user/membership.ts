import { InlineKeyboard } from 'grammy';
import { getUserByTelegramId } from '../../../database/users';
import { isMembershipActive, getSubscriptionPlans } from '../../../database/memberships';
import { supabase } from '../../../database/client';
import { paymentService } from '../../../services/payment/payment.service';

export const setupMembershipCallback = (bot: any) => {
  bot.callbackQuery('user:membership', async (ctx: any) => {
    const user = await getUserByTelegramId(ctx.from!.id);
    if (!user) return ctx.answerCallbackQuery('User tidak ditemukan.');
    
    let msg = `💎 MEMBERSHIP\n\n`;
    
    const isActive = isMembershipActive(user);
    if (isActive) {
      const expiresAt = new Date(user.membership_expires_at!).toLocaleDateString('id-ID', { dateStyle: 'long' });
      const diffTime = Math.abs(new Date(user.membership_expires_at!).getTime() - new Date().getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      msg += `Status: Premium\n`;
      msg += `Berlaku sampai: ${expiresAt}\n`;
      msg += `Sisa: ${diffDays} hari\n`;
    } else {
      msg += `Status: Free\n`;
    }
    
    msg += `\nReferral Code Anda: ${user.referral_code}\nShare link: https://t.me/${bot.botInfo.username}?start=${user.referral_code}`;

    const kb = new InlineKeyboard();
    kb.text(isActive ? '💎 Perpanjang Premium' : '💎 Upgrade Premium', 'user:membership:buy').row();
    kb.text('⬅️ Kembali', 'menu_profile');

    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('user:membership:buy', async (ctx: any) => {
    const plans = await getSubscriptionPlans(true);
    if (plans.length === 0) {
      return ctx.answerCallbackQuery('Belum ada paket tersedia.');
    }
    
    let msg = `Pilih paket berlangganan:\n\n`;
    const kb = new InlineKeyboard();
    
    plans.forEach(p => {
      kb.text(`${p.name} - Rp ${p.price.toLocaleString('id-ID')}`, `user:membership:plan:${p.id}`).row();
    });
    kb.text('⬅️ Kembali', 'user:membership');
    
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/user:membership:plan:(.+)/, async (ctx: any) => {
    const plan_id = ctx.match[1];
    const plans = await getSubscriptionPlans(true);
    const plan = plans.find(p => p.id === plan_id);
    if (!plan) return ctx.answerCallbackQuery('Paket tidak ditemukan.');
    
    try {
      await ctx.editMessageText('🔄 Menghasilkan link pembayaran...');
      
      const order_number = `SUB-${plan.id.split('-')[0]}-${Date.now()}`;
      
      // We manually create an order for this subscription. We don't use cart checkout.
      const { data: order, error } = await supabase.from('orders').insert([{
        order_number,
        telegram_id: ctx.from!.id,
        status: 'pending',
        subtotal: plan.price,
        discount: 0,
        total: plan.price,
        coupon_code: null
      }]).select().single();
      
      if (error || !order) throw new Error('Gagal membuat order subscription');
      
      const { url } = await paymentService.generatePaymentUrl(order.id, ctx.from!.id);
      
      const kb = new InlineKeyboard()
        .url('💳 Lanjutkan Pembayaran', url)
        .row()
        .text('📦 Kembali ke Pesanan', `shop:order:${order.id}`);
        
      await ctx.editMessageText(`💳 PEMBELIAN SUBSCRIPTION\n\nSilakan klik tombol di bawah untuk melakukan pembayaran.`, { reply_markup: kb });
    } catch(e: any) {
      const kb = new InlineKeyboard().text('⬅️ Kembali', 'user:membership');
      await ctx.editMessageText(`Gagal: ${e.message}`, { reply_markup: kb });
    }
  });
};
