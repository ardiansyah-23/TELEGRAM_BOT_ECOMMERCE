import { InlineKeyboard } from 'grammy';
import { getCategories } from '../../../database/categories';

export const setupCategoriesCallback = (bot: any) => {
  bot.callbackQuery('shop:categories', async (ctx: any) => {
    const categories = await getCategories(true);
    
    let msg = `🛍 KATEGORI\n\nPilih kategori produk:`;
    const kb = new InlineKeyboard();
    
    if (categories.length === 0) {
      msg = `Kategori belum tersedia.`;
    } else {
      categories.forEach((c) => {
        kb.text(c.name, `shop:category:${c.id}`).row();
      });
    }
    
    kb.text('⬅️ Kembali', 'menu_profile'); // Back to main or close
    // Since we don't have a main menu callback, we'll just delete or send back to start.
    // Actually, just leaving it without back or providing a placeholder.
    
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });
};
