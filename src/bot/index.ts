import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { limit } from '@grammyjs/ratelimiter';
import { config } from '../config/env';
import { setupStartCommand } from './commands/start';
import { setupHelpCommand } from './commands/help';
import { setupProfileCommand } from './commands/profile';
import { setupAdminCommand } from './commands/admin';
import { setupMenuCallbacks } from './callbacks/menuCallback';
import { setupAdminCallbacks } from './callbacks/admin';
import { setupShopCallbacks } from './callbacks/shop';
import { setupMembershipCallback } from './callbacks/user/membership';
import { setupPointsCallback } from './callbacks/user/points';
import { setupRemindersCallback } from './callbacks/user/reminders';
import { setupPreferencesCallback } from './callbacks/user/preferences';
import { autoRegisterAndLogMiddleware } from './middleware/auth';
import { sessionMiddleware } from './middleware/session';
import { broadcastConversation } from './conversations/broadcast';
import { searchConversation } from './conversations/search';
import { addCategoryConversation, addProductConversation } from './conversations/admin_product';
import { checkoutVoucherConversation } from './conversations/checkout_voucher';
import { createReminderConversation } from './conversations/create_reminder';
import { paymentProofConversation } from './conversations/payment_proof';
import { setupSubscribeCommands } from './commands/subscribe';
import type { MyContext } from './types';

// Initialize the bot with generic context
export const bot = new Bot<MyContext>(config.BOT_TOKEN!);

// Anti-Spam Rate Limiter (Max 3 messages per 2 seconds per user)
bot.use(limit({
  timeFrame: 2000,
  limit: 3,
  onLimitExceeded: async (ctx) => {
    if (ctx.chat?.type === 'private') {
      try {
        await ctx.reply('⏳ Terlalu banyak request. Silakan tunggu sebentar.');
      } catch (e) {
        // Ignore if we can't reply
      }
    }
  },
  keyGenerator: (ctx) => {
    return ctx.from?.id.toString();
  }
}));

// Setup session and conversations
bot.use(sessionMiddleware() as any);
bot.use(conversations() as any);

// Register conversations
bot.use(createConversation(broadcastConversation as any) as any);
bot.use(createConversation(searchConversation as any) as any);
bot.use(createConversation(addCategoryConversation as any) as any);
bot.use(createConversation(addProductConversation as any) as any);
bot.use(createConversation(checkoutVoucherConversation as any) as any);
bot.use(createConversation(createReminderConversation as any) as any);
bot.use(createConversation(paymentProofConversation as any) as any);

// Global middleware for auto-register and logging
bot.use(autoRegisterAndLogMiddleware);

// Setup commands
setupStartCommand(bot as any);
setupSubscribeCommands(bot as any);
setupHelpCommand(bot as any);
setupProfileCommand(bot as any);
setupAdminCommand(bot);

// Setup callbacks
setupMenuCallbacks(bot as any);
setupAdminCallbacks(bot as any);
setupShopCallbacks(bot as any);
setupMembershipCallback(bot as any);
setupPointsCallback(bot as any);
setupRemindersCallback(bot as any);
setupPreferencesCallback(bot as any);

// Basic error handling
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof Error) {
    console.error('Error message:', e.message);
    // Do not log sensitive details like BOT_TOKEN here
  } else {
    console.error('Unknown error:', e);
  }
});
