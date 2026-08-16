import { InlineKeyboard } from 'grammy';
import { requireAdmin } from '../../middleware/admin';
import { supabase } from '../../../database/client';

export const setupAdminProductsCallback = (bot: any) => {
  bot.callbackQuery('admin:products', requireAdmin as any, async (ctx: any) => {
    const kb = new InlineKeyboard()
      .text('➕ Tambah Produk', 'admin:product:add').row()
      .text('➕ Tambah Kategori', 'admin:category:add').row()
      .text('📝 List Kategori', 'admin:categories:list').row()
      .text('📝 List Produk', 'admin:products:list:1').row()
      .text('⬅️ Kembali', 'admin:menu');
      
    await ctx.editMessageText('📦 MANAJEMEN PRODUK', { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });
  
  bot.callbackQuery('admin:product:add', requireAdmin as any, async (ctx: any) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('addProductConversation');
  });
  
  bot.callbackQuery('admin:category:add', requireAdmin as any, async (ctx: any) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('addCategoryConversation');
  });

  bot.callbackQuery(/admin:products:list:(\d+)/, requireAdmin as any, async (ctx: any) => {
    const page = parseInt(ctx.match[1]);
    const limit = 5;
    const offset = (page - 1) * limit;

    const { data: products, count } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!products || products.length === 0) {
      return ctx.answerCallbackQuery('Tidak ada produk.');
    }

    const kb = new InlineKeyboard();
    let msg = `📦 DAFTAR PRODUK\n\n`;

    products.forEach((p, i) => {
      msg += `${offset + i + 1}. ${p.name} (Rp ${p.price}) - Stok: ${p.stock}\nStatus: ${p.is_active ? 'Aktif' : 'Nonaktif'}\n\n`;
      kb.text(p.is_active ? `🔴 Matikan #${offset + i + 1}` : `🟢 Aktifkan #${offset + i + 1}`, `admin:product:toggle:${p.id}`);
      if ((i + 1) % 2 === 0) kb.row();
    });
    kb.row();
    
    kb.text('⬅️ Kembali', 'admin:products');

    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/admin:product:toggle:(.+)/, requireAdmin as any, async (ctx: any) => {
    const product_id = ctx.match[1];
    const { data } = await supabase.from('products').select('is_active').eq('id', product_id).single();
    if (data) {
      await supabase.from('products').update({ is_active: !data.is_active }).eq('id', product_id);
    }
    await ctx.answerCallbackQuery('Status produk diubah.');
    // Optimally we should refresh the list, but for simplicity we just notify
  });
};
