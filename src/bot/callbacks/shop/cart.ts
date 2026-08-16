import { InlineKeyboard } from 'grammy';
import { getCart, addToCart, updateCartQuantity, removeFromCart, clearCart } from '../../../database/cart';
import { getProductById } from '../../../database/products';

export const setupCartCallback = (bot: any) => {
  
  const showCart = async (ctx: any) => {
    const cart = await getCart(ctx.from!.id);
    
    if (cart.length === 0) {
      const kb = new InlineKeyboard().text('🛍 Mulai Belanja', 'shop:categories');
      await ctx.editMessageText('🛒 Keranjang kamu masih kosong.', { reply_markup: kb });
      return;
    }
    
    let msg = `🛒 KERANJANG\n\n`;
    let subtotal = 0;
    
    const kb = new InlineKeyboard();
    
    for (const item of cart) {
      if (!item.products) continue;
      
      const p = item.products;
      const itemSubtotal = p.price * item.quantity;
      subtotal += itemSubtotal;
      
      msg += `🔹 ${p.name}\n`;
      msg += `Rp ${p.price.toLocaleString('id-ID')} × ${item.quantity}\n`;
      msg += `Subtotal: Rp ${itemSubtotal.toLocaleString('id-ID')}\n\n`;
      
      kb.text('➖', `shop:cart:minus:${p.id}`)
        .text(`${item.quantity}`, 'noop')
        .text('➕', `shop:cart:plus:${p.id}`)
        .text('🗑', `shop:cart:remove:${p.id}`)
        .row();
    }
    
    msg += `\n**Total: Rp ${subtotal.toLocaleString('id-ID')}**`;
    
    kb.text('🧾 Checkout', 'shop:checkout').row();
    kb.text('🗑 Kosongkan Keranjang', 'shop:cart:clear');
    
    await ctx.editMessageText(msg, { reply_markup: kb });
  };

  bot.callbackQuery('shop:cart', async (ctx: any) => {
    await ctx.answerCallbackQuery();
    await showCart(ctx);
  });

  bot.callbackQuery(/shop:cart:add:(.+)/, async (ctx: any) => {
    const product_id = ctx.match[1];
    const p = await getProductById(product_id);
    if (!p || p.stock < 1) {
      return ctx.answerCallbackQuery('❌ Gagal: Stok habis atau produk tidak ditemukan.');
    }
    
    await addToCart(ctx.from!.id, product_id, 1);
    await ctx.answerCallbackQuery('✅ Ditambahkan ke keranjang!');
  });

  bot.callbackQuery(/shop:cart:plus:(.+)/, async (ctx: any) => {
    const product_id = ctx.match[1];
    const cart = await getCart(ctx.from!.id);
    const item = cart.find(c => c.product_id === product_id);
    
    if (item && item.products) {
      if (item.quantity >= item.products.stock) {
        await ctx.answerCallbackQuery('❌ Stok tidak mencukupi.');
        return;
      }
      await updateCartQuantity(ctx.from!.id, product_id, item.quantity + 1);
      await showCart(ctx);
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/shop:cart:minus:(.+)/, async (ctx: any) => {
    const product_id = ctx.match[1];
    const cart = await getCart(ctx.from!.id);
    const item = cart.find(c => c.product_id === product_id);
    
    if (item) {
      if (item.quantity <= 1) {
        await removeFromCart(ctx.from!.id, product_id);
      } else {
        await updateCartQuantity(ctx.from!.id, product_id, item.quantity - 1);
      }
      await showCart(ctx);
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/shop:cart:remove:(.+)/, async (ctx: any) => {
    const product_id = ctx.match[1];
    await removeFromCart(ctx.from!.id, product_id);
    await ctx.answerCallbackQuery('🗑 Dihapus.');
    await showCart(ctx);
  });

  bot.callbackQuery('shop:cart:clear', async (ctx: any) => {
    await clearCart(ctx.from!.id);
    await ctx.answerCallbackQuery('Keranjang dikosongkan.');
    await showCart(ctx);
  });
};
