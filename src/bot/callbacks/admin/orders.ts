import { InlineKeyboard } from 'grammy';
import { requireAdmin } from '../../middleware/admin';
import { supabase } from '../../../database/client';
import { updateOrderStatus } from '../../../database/orders';

export const setupAdminOrdersCallback = (bot: any) => {
  bot.callbackQuery(/admin:orders(?::(\d+))?/, requireAdmin as any, async (ctx: any) => {
    const page = ctx.match && ctx.match[1] ? parseInt(ctx.match[1]) : 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    const { data: orders, count } = await supabase
      .from('orders')
      .select('id, order_number, status, total, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!orders || orders.length === 0) {
      const kb = new InlineKeyboard().text('⬅️ Kembali', 'admin:menu');
      return ctx.editMessageText('Tidak ada pesanan.', { reply_markup: kb });
    }

    const totalPages = Math.ceil((count || 0) / limit);
    const kb = new InlineKeyboard();
    let msg = `🧾 DAFTAR PESANAN\n\n`;

    orders.forEach((o, i) => {
      msg += `**${o.order_number}** - Rp ${o.total.toLocaleString('id-ID')}\nStatus: ${o.status.toUpperCase()}\n\n`;
      kb.text(`Aksi #${offset + i + 1}`, `admin:order:action:${o.id}`);
      if ((i + 1) % 2 === 0) kb.row();
    });
    kb.row();

    if (page > 1) kb.text('⬅️', `admin:orders:${page - 1}`);
    kb.text(`${page}/${totalPages}`, 'noop');
    if (page < totalPages) kb.text('➡️', `admin:orders:${page + 1}`);
    kb.row();
    kb.text('⬅️ Kembali', 'admin:menu');

    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/admin:order:action:(.+)/, requireAdmin as any, async (ctx: any) => {
    const order_id = ctx.match[1];
    
    const kb = new InlineKeyboard()
      .text('Set Confirmed', `admin:order:status:${order_id}:confirmed`).row()
      .text('Set Processing', `admin:order:status:${order_id}:processing`).row()
      .text('Set Completed', `admin:order:status:${order_id}:completed`).row()
      .text('Set Cancelled', `admin:order:status:${order_id}:cancelled`).row()
      .text('⬅️ Kembali', 'admin:orders:1');

    await ctx.editMessageText(`Ubah status untuk pesanan ini:`, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/admin:order:status:(.+):(.+)/, requireAdmin as any, async (ctx: any) => {
    const order_id = ctx.match[1];
    const status = ctx.match[2];
    
    await updateOrderStatus(order_id, status);
    
    await ctx.answerCallbackQuery(`Status diubah menjadi ${status}`);
    const kb = new InlineKeyboard().text('⬅️ List Pesanan', 'admin:orders:1');
    await ctx.editMessageText(`✅ Status pesanan diupdate: ${status.toUpperCase()}`, { reply_markup: kb });
  });
};
