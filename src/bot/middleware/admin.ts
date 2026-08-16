import { NextFunction } from 'grammy';
import type { MyContext } from '../types';
import { getUserByTelegramId } from '../../database/users';

export const requireAdmin = async (ctx: MyContext, next: NextFunction) => {
  if (!ctx.from || !ctx.from.id) {
    return;
  }
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user || user.role !== 'admin') {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery('Akses ditolak: Hanya untuk Admin.');
      } else {
        await ctx.reply('❌ Kamu tidak memiliki akses ke fitur ini.');
      }
    } else {
      await next();
    }
};
