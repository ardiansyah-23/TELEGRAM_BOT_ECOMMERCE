import { Bot } from 'grammy';
import { requireAdmin } from '../../middleware/admin';
import type { MyContext } from '../../types';

export const setupSearchCallback = (bot: any) => {
  bot.callbackQuery('admin:search', requireAdmin as any, async (ctx: any) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('searchConversation');
  });
};
