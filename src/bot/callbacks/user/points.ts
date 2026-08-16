import { InlineKeyboard } from 'grammy';
import { getWallet, getPointTransactions } from '../../../database/points';

export const setupPointsCallback = (bot: any) => {
  bot.callbackQuery('user:points', async (ctx: any) => {
    const telegram_id = ctx.from!.id;
    const wallet = await getWallet(telegram_id);
    
    if (!wallet) {
      return ctx.answerCallbackQuery('Wallet belum terdaftar.');
    }
    
    let msg = `💰 POIN SAYA\n\n`;
    msg += `Saldo: ${wallet.balance.toLocaleString('id-ID')} poin\n\n`;
    
    const kb = new InlineKeyboard()
      .text('📜 Riwayat Transaksi', 'user:points:history:1')
      .row()
      .text('⬅️ Kembali', 'menu_profile');
      
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/user:points:history:(\d+)/, async (ctx: any) => {
    const page = parseInt(ctx.match[1]) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;
    
    const { data: txs, count } = await getPointTransactions(ctx.from!.id, limit, offset);
    const totalPages = Math.ceil(count / limit) || 1;
    
    let msg = `📜 RIWAYAT POIN (Hal ${page}/${totalPages})\n\n`;
    
    if (txs.length === 0) {
      msg += `Belum ada transaksi poin.`;
    } else {
      txs.forEach(tx => {
        const sign = tx.type === 'credit' ? '+' : '-';
        const date = new Date(tx.created_at).toLocaleDateString('id-ID');
        msg += `[${date}] ${sign}${tx.amount}\n`;
        msg += `Keterangan: ${tx.description || '-'}\n\n`;
      });
    }
    
    const kb = new InlineKeyboard();
    const nav = [];
    if (page > 1) nav.push(InlineKeyboard.text('⬅️ Prev', `user:points:history:${page - 1}`));
    if (page < totalPages) nav.push(InlineKeyboard.text('Next ➡️', `user:points:history:${page + 1}`));
    if (nav.length > 0) kb.row(...nav);
    
    kb.row().text('⬅️ Kembali', 'user:points');
    
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });
};
