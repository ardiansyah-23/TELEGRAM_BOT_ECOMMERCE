import { InlineKeyboard } from 'grammy';
import { getCart } from '../../../database/cart';
import { checkoutCartWithVoucherAtomic } from '../../../database/coupons';
import { getOrderById } from '../../../database/orders';

export const setupCheckoutCallback = (bot: any) => {
  bot.callbackQuery('shop:checkout', async (ctx: any) => {
    const cart = await getCart(ctx.from!.id);
    
    if (cart.length === 0) {
      await ctx.answerCallbackQuery('Keranjang kamu kosong.', { show_alert: true });
      return;
    }
    
    let msg = `🧾 CHECKOUT\n\nProduk:\n`;
    let subtotal = 0;
    let hasError = false;
    
    for (const item of cart) {
      if (!item.products) continue;
      
      const p = item.products;
      if (!p.is_active || p.stock < item.quantity) {
        hasError = true;
      }
      
      const itemSubtotal = p.price * item.quantity;
      subtotal += itemSubtotal;
      
      msg += `- ${p.name} (${item.quantity}x) = Rp ${itemSubtotal.toLocaleString('id-ID')}\n`;
    }
    
    if (hasError) {
      await ctx.answerCallbackQuery('⚠️ Beberapa produk tidak aktif atau stok tidak mencukupi. Silakan periksa keranjang Anda.', { show_alert: true });
      return;
    }
    
    msg += `\nSubtotal: Rp ${subtotal.toLocaleString('id-ID')}`;
    msg += `\nTotal: Rp ${subtotal.toLocaleString('id-ID')}\n\n`;
    msg += `Apakah data sudah benar?`;
    
    const kb = new InlineKeyboard()
      .text('✅ Buat Pesanan', 'shop:checkout:confirm:none').row()
      .text('🎟 Gunakan Voucher', 'shop:checkout:voucher').row()
      .text('❌ Batal', 'shop:cart');
      
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('shop:checkout:voucher', async (ctx: any) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('checkoutVoucherConversation');
  });

  bot.callbackQuery(/shop:checkout:confirm:(.+)/, async (ctx: any) => {
    const coupon_code = ctx.match[1] === 'none' ? null : ctx.match[1];
    const telegram_id = ctx.from!.id;
    // Generate order number
    const dateStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 8);
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const order_number = `ORD-${dateStr}-${randomSuffix}`;
    
    try {
      await ctx.editMessageText('🔄 Sedang memproses pesanan...');
      
      const order_id = await checkoutCartWithVoucherAtomic(telegram_id, order_number, coupon_code);
      
      if (order_id) {
        const data = await getOrderById(order_id);
        if (!data) throw new Error('Order not found after creation');
        
        const qrisUrl = process.env.QRIS_IMAGE_URL || 'https://raw.githubusercontent.com/ardiansyah-23/TELEGRAM_BOT_ECOMMERCE/main/public/qris.jpg';
        const adminUsername = process.env.ADMIN_USERNAME || 'Admin'; // e.g. "admin_digitalia"
        
        let msg = `🧾 **PESANAN BERHASIL DIBUAT**\n\n`;
        msg += `Order: ${order_number}\n`;
        msg += `Total Tagihan: **Rp ${data.order.total.toLocaleString('id-ID')}**\n\n`;
        msg += `💳 **Instruksi Pembayaran:**\n`;
        msg += `Silakan scan gambar QRIS di bawah ini untuk melakukan pembayaran.\n\n`;
        msg += `Jika sudah berhasil transfer, silakan klik tombol "📸 Kirim Bukti Pembayaran" di bawah ini.\n\n`;
        msg += `Atau hubungi Admin via Telegram: @${adminUsername}`;
        
        const kb = new InlineKeyboard()
          .text('📸 Kirim Bukti Pembayaran', `shop:payment_proof:${order_id}`)
          .row()
          .text('📦 Lihat Pesanan', `shop:order:${order_id}`);
          
        await ctx.deleteMessage();
        await ctx.replyWithPhoto(qrisUrl, {
          caption: msg,
          reply_markup: kb,
          parse_mode: 'Markdown'
        });
      } else {
        await ctx.editMessageText('❌ Gagal memproses pesanan.');
      }
    } catch (e: any) {
      await ctx.editMessageText(`❌ Gagal: ${e.message}`);
    }
    
    await ctx.answerCallbackQuery();
  });
};
