import { Bot } from 'grammy';
import { requireAdmin } from '../middleware/admin';
import { getAdminKeyboard } from '../callbacks/admin';
import { countUsers, countActiveUsers } from '../../database/users';
import { supabase } from '../../database/client';
import type { MyContext } from '../types';

export const setupAdminCommand = (bot: any) => {
  // Wrap the command with the requireAdmin middleware
  bot.command('admin', requireAdmin as any, async (ctx: any) => {
    
    const totalUsers = await countUsers();
    const activeUsers = await countActiveUsers();
    
    // Fetch basic e-commerce stats (quick)
    const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { count: totalOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    
    const adminMsg = `🛠 ADMIN PANEL

📊 STATISTICS
Total Users: ${totalUsers}
Active Users (7 hari): ${activeUsers}
Blocked Users: -
Total Products: ${totalProducts || 0}
Total Orders: ${totalOrders || 0}
`;

    await ctx.reply(adminMsg, { reply_markup: getAdminKeyboard() });
  });
};
