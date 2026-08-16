import { InlineKeyboard } from 'grammy';
import { getUserOrders, getOrderById } from '../../../database/orders';
import { paymentService } from '../../../services/payment/payment.service';

export const setupOrdersCallback = (bot: any) => {
  bot.callbackQuery(/shop:orders(?::(\d+))?/, async (ctx: any) => {
    const page = ctx.match && ctx.match[1] ? parseInt(ctx.match[1]) : 1;
    const limit = 5;
    const offset = (page - 1) * limit;
    
    const { data: orders, count } = await getUserOrders(ctx.from!.id, limit, offset);
    
    if (orders.length === 0) {
      const kb = new InlineKeyboard().text('🛍 Mulai Belanja', 'shop:categories');
      await ctx.editMessageText('📦 Kamu belum memiliki pesanan.', { reply_markup: kb });
      return;
    }
    
    const totalPages = Math.ceil(count / limit);
    let msg = `📦 PESANAN SAYA\n\n`;
    
    const kb = new InlineKeyboard();
    
    orders.forEach((o, i) => {
      msg += `**${o.order_number}**\n`;
      msg += `Status: ${o.status.toUpperCase()}\n`;
      msg += `Total: Rp ${o.total.toLocaleString('id-ID')}\n\n`;
      kb.text(`Detail #${offset + i + 1}`, `shop:order:${o.id}`);
      if ((i + 1) % 2 === 0) kb.row();
    });
    kb.row();
    
    if (page > 1) kb.text('⬅️', `shop:orders:${page - 1}`);
    kb.text(`${page}/${totalPages}`, 'noop');
    if (page < totalPages) kb.text('➡️', `shop:orders:${page + 1}`);
    kb.row();
    
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/shop:order:(.+)/, async (ctx: any) => {
    const order_id = ctx.match[1];
    const data = await getOrderById(order_id);
    
    if (!data) {
      return ctx.answerCallbackQuery('❌ Pesanan tidak ditemukan.');
    }
    
    const { order, items } = data;
    
    // Security check
    if (order.telegram_id !== ctx.from!.id) {
      return ctx.answerCallbackQuery('❌ Akses ditolak.');
    }
    
    let msg = `📦 DETAIL PESANAN\n\n`;
    msg += `Order: ${order.order_number}\n`;
    msg += `Status: ${order.status.toUpperCase()}\n`;
    msg += `Tanggal: ${new Date(order.created_at).toLocaleString('id-ID')}\n\n`;
    
    msg += `Produk:\n`;
    items.forEach((item) => {
      msg += `- ${item.product_name} (${item.quantity}x) = Rp ${item.subtotal.toLocaleString('id-ID')}\n`;
    });
    
    msg += `\nSubtotal: Rp ${order.subtotal.toLocaleString('id-ID')}`;
    msg += `\nTotal: Rp ${order.total.toLocaleString('id-ID')}`;
    
    const kb = new InlineKeyboard();
    
    if (order.status === 'pending') {
      kb.text('💳 BAYAR SEKARANG', `shop:pay:${order.id}`).row();
    }
    
    kb.text('⬅️ Kembali', 'shop:orders:1');
    
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/shop:pay:(.+)/, async (ctx: any) => {
    const order_id = ctx.match[1];
    
    try {
      await ctx.editMessageText('🔄 Menghasilkan link pembayaran...');
      
      const { url } = await paymentService.generatePaymentUrl(order_id, ctx.from!.id);
      
      const kb = new InlineKeyboard()
        .url('💳 Lanjutkan Pembayaran', url)
        .row()
        .text('📦 Kembali ke Pesanan', `shop:order:${order_id}`);
        
      await ctx.editMessageText(`💳 PEMBAYARAN\n\nSilakan klik tombol di bawah untuk melakukan pembayaran.`, { reply_markup: kb });
      
    } catch (e: any) {
      const kb = new InlineKeyboard().text('⬅️ Kembali', `shop:order:${order_id}`);
      await ctx.editMessageText(`❌ Gagal menghasilkan link pembayaran: ${e.message}`, { reply_markup: kb });
    }
    await ctx.answerCallbackQuery();
  });
};
