import { InlineKeyboard } from 'grammy';
import { getProductsByCategory, getProductById } from '../../../database/products';

export const setupProductsCallback = (bot: any) => {
  // List products in a category
  bot.callbackQuery(/shop:category:(.+)/, async (ctx: any) => {
    const category_id = ctx.match[1];
    const products = await getProductsByCategory(category_id, true);
    
    let msg = `🛍 PRODUK\n\n`;
    const kb = new InlineKeyboard();
    
    if (products.length === 0) {
      msg += `Belum ada produk di kategori ini.`;
    } else {
      products.forEach((p) => {
        kb.text(`${p.name} - Rp ${p.price.toLocaleString('id-ID')}`, `shop:product:${p.id}`).row();
      });
    }
    
    kb.text('⬅️ Kembali ke Kategori', 'shop:categories');
    
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  // Product detail
  bot.callbackQuery(/shop:product:(.+)/, async (ctx: any) => {
    const product_id = ctx.match[1];
    const product = await getProductById(product_id);
    
    if (!product || !product.is_active) {
      await ctx.answerCallbackQuery('Produk tidak ditemukan atau tidak aktif.');
      return;
    }
    
    let msg = `📦 PRODUK DETAIL\n\n`;
    msg += `Nama: ${product.name}\n`;
    msg += `Kategori: ${product.categories?.name || '-'}\n`;
    msg += `Harga: Rp ${product.price.toLocaleString('id-ID')}\n`;
    msg += `Stok: ${product.stock > 0 ? product.stock : 'Habis'}\n\n`;
    msg += `Deskripsi:\n${product.description || '-'}`;
    
    const kb = new InlineKeyboard();
    
    if (product.stock > 0) {
      kb.text('🛒 Tambah ke Keranjang', `shop:cart:add:${product.id}`).row();
    } else {
      kb.text('❌ Stok Habis', 'noop').row();
    }
    
    kb.text('⬅️ Kembali', `shop:category:${product.category_id}`);
    
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });
};
