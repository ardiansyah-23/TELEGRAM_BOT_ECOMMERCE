import { Bot, InlineKeyboard } from 'grammy';
import { requireAdmin } from '../../middleware/admin';
import { setupUsersCallback } from './users';
import { setupBanCallback } from './ban';
import { setupSearchCallback } from './search';
import { setupBroadcastCallback } from './broadcast';
import { setupAdminProductsCallback } from './products';
import { setupAdminOrdersCallback } from './orders';
import { setupAdminPaymentsCallback } from './payments';
import { setupBusinessCallbacks } from './business';
import { setupAdminSchedulerCallback } from './scheduler';
import { setupAdminCampaignCallback } from './campaigns';
import type { MyContext } from '../../types';

export const setupAdminCallbacks = (bot: any) => {
  // We can attach requireAdmin middleware at the callback level or route level
  
  // Register modular callbacks
  setupUsersCallback(bot);
  setupBanCallback(bot);
  setupSearchCallback(bot);
  setupBroadcastCallback(bot);
  setupAdminProductsCallback(bot);
  setupAdminOrdersCallback(bot);
  setupAdminPaymentsCallback(bot);
  setupBusinessCallbacks(bot);
  setupAdminSchedulerCallback(bot);
  setupAdminCampaignCallback(bot);

  bot.callbackQuery('admin:menu', async (ctx: any) => {
    await ctx.editMessageReplyMarkup({ reply_markup: getAdminKeyboard() });
    await ctx.answerCallbackQuery();
  });
};

export const getAdminKeyboard = () => {
  const adminUrl = process.env.WEB_APP_URL ? `${process.env.WEB_APP_URL}/admin/` : 'https://example.com/admin/';

  return new InlineKeyboard()
    .webApp('🌐 Buka Web Dashboard', adminUrl)
    .row()
    .text('👥 Users', 'admin:users:1')
    .text('📊 Statistics', 'admin:stats')
    .row()
    .text('📦 Products', 'admin:products')
    .text('🧾 Orders', 'admin:orders:1')
    .row()
    .text('💳 Payments', 'admin:payments:1')
    .row()
    .text('📢 Broadcast', 'admin:broadcast')
    .text('⏰ Scheduler', 'admin:scheduler')
    .row()
    .text('🎯 Campaigns', 'admin:campaigns')
    .text('💼 Bisnis & Membership', 'admin:business')
    .row()
    .text('⚙️ Settings', 'admin:settings');
};
