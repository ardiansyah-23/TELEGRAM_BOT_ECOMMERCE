import { InlineKeyboard } from 'grammy';
import { requireAdmin } from '../../middleware/admin';
import { supabase } from '../../../database/client';

export const setupAdminPaymentsCallback = (bot: any) => {
  bot.callbackQuery(/admin:payments(?::(\d+))?/, requireAdmin as any, async (ctx: any) => {
    const page = ctx.match && ctx.match[1] ? parseInt(ctx.match[1]) : 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    const { data: payments, count } = await supabase
      .from('payments')
      .select('id, provider, amount, status, created_at, orders(order_number)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!payments || payments.length === 0) {
      const kb = new InlineKeyboard().text('⬅️ Kembali', 'admin:menu');
      return ctx.editMessageText('Tidak ada pembayaran.', { reply_markup: kb });
    }

    const totalPages = Math.ceil((count || 0) / limit);
    const kb = new InlineKeyboard();
    let msg = `💳 DAFTAR PEMBAYARAN\n\n`;

    payments.forEach((p, i) => {
      // TypeScript safety since orders is joined
      const orderNumber = (p.orders as any)?.order_number || 'Unknown';
      msg += `**${orderNumber}** - Rp ${p.amount.toLocaleString('id-ID')}\nStatus: ${p.status.toUpperCase()}\n\n`;
      kb.text(`Detail #${offset + i + 1}`, `admin:payment:detail:${p.id}`);
      if ((i + 1) % 2 === 0) kb.row();
    });
    kb.row();

    if (page > 1) kb.text('⬅️', `admin:payments:${page - 1}`);
    kb.text(`${page}/${totalPages}`, 'noop');
    if (page < totalPages) kb.text('➡️', `admin:payments:${page + 1}`);
    kb.row();
    kb.text('⬅️ Kembali', 'admin:menu');

    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/admin:payment:detail:(.+)/, requireAdmin as any, async (ctx: any) => {
    const payment_id = ctx.match[1];
    
    const { data: payment } = await supabase
      .from('payments')
      .select('*, orders(order_number)')
      .eq('id', payment_id)
      .single();
      
    if (!payment) return ctx.answerCallbackQuery('Payment tidak ditemukan');

    const orderNumber = (payment.orders as any)?.order_number || 'Unknown';

    let msg = `💳 PAYMENT DETAIL\n\n`;
    msg += `Order: ${orderNumber}\n`;
    msg += `Provider: ${payment.provider}\n`;
    msg += `Amount: Rp ${payment.amount.toLocaleString('id-ID')}\n`;
    msg += `Status: ${payment.status.toUpperCase()}\n`;
    msg += `Transaction ID: ${payment.provider_transaction_id || '-'}\n`;
    msg += `Created: ${new Date(payment.created_at).toLocaleString('id-ID')}\n`;
    if (payment.paid_at) {
      msg += `Paid: ${new Date(payment.paid_at).toLocaleString('id-ID')}\n`;
    }

    const kb = new InlineKeyboard().text('⬅️ Kembali', 'admin:payments:1');
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });
};
