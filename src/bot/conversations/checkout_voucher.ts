import { InlineKeyboard } from 'grammy';
import type { MyContext, MyConversation } from '../types';
import { getCart } from '../../database/cart';
import { checkoutCartWithVoucherAtomic } from '../../database/coupons';

export async function checkoutVoucherConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.editMessageText('Ketik kode voucher yang ingin Anda gunakan:\n(Ketik "batal" untuk kembali tanpa menggunakan voucher)');
  
  const inputCtx = await conversation.waitFor('message:text');
  const code = inputCtx.message.text.trim();
  
  if (code.toLowerCase() === 'batal') {
    await inputCtx.reply('Batal menggunakan voucher.');
    // Show checkout confirm again without voucher
    await sendCheckoutConfirm(inputCtx, null);
    return;
  }
  
  // Validate voucher in DB later, just pass it to the confirm step
  await sendCheckoutConfirm(inputCtx, code);
}

const sendCheckoutConfirm = async (ctx: any, coupon_code: string | null) => {
    const cart = await getCart(ctx.from!.id);
    if (cart.length === 0) {
      return ctx.reply('Keranjang kamu kosong.');
    }
    
    let msg = `🧾 CHECKOUT\n\nProduk:\n`;
    let subtotal = 0;
    
    for (const item of cart) {
      if (!item.products) continue;
      const p = item.products;
      const itemSubtotal = p.price * item.quantity;
      subtotal += itemSubtotal;
      msg += `- ${p.name} (${item.quantity}x) = Rp ${itemSubtotal.toLocaleString('id-ID')}\n`;
    }
    
    msg += `\nSubtotal: Rp ${subtotal.toLocaleString('id-ID')}`;
    if (coupon_code) {
      msg += `\nVoucher Code: ${coupon_code} (Akan divalidasi saat konfirmasi)`;
    }
    msg += `\n\nApakah data sudah benar?`;
    
    const kb = new InlineKeyboard()
      .text('✅ Konfirmasi & Buat Pesanan', `shop:checkout:confirm:${coupon_code || 'none'}`).row()
      .text('🎟 Gunakan Voucher', 'shop:checkout:voucher').row()
      .text('❌ Batal', 'shop:cart');
      
    await ctx.reply(msg, { reply_markup: kb });
}
