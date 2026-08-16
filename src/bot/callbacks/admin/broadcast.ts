import { Bot, InlineKeyboard } from 'grammy';
import { requireAdmin } from '../../middleware/admin';
import type { MyContext } from '../../types';

export const setupBroadcastCallback = (bot: any) => {
  bot.callbackQuery('admin:broadcast', requireAdmin as any, async (ctx: any) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('broadcastConversation');
  });
};
