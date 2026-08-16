import { InlineKeyboard } from 'grammy';
import { supabase } from '../../../database/client';

export const setupBusinessCallbacks = (bot: any) => {
  bot.callbackQuery('admin:business', async (ctx: any) => {
    let msg = `⚙️ MANAJEMEN BISNIS\n\nPilih menu yang ingin dikelola:`;
    const kb = new InlineKeyboard()
      .text('💎 Memberships', 'admin:business:memberships').row()
      .text('📋 Subscription Plans', 'admin:business:plans').row()
      .text('🎟 Coupons', 'admin:business:coupons').row()
      .text('👥 Referrals & Points', 'admin:business:referrals').row()
      .text('⬅️ Kembali', 'admin:menu');
      
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('admin:business:memberships', async (ctx: any) => {
    const { count: premiumCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('membership_level', 'premium');
    
    let msg = `💎 MEMBERSHIPS\n\nTotal User Premium: ${premiumCount || 0}\n\n`;
    msg += `(Fitur manajemen manual sedang dalam pengembangan)`;
    
    const kb = new InlineKeyboard().text('⬅️ Kembali', 'admin:business');
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('admin:business:plans', async (ctx: any) => {
    const { data: plans } = await supabase.from('subscription_plans').select('*');
    let msg = `📋 SUBSCRIPTION PLANS\n\n`;
    
    if (plans && plans.length > 0) {
      plans.forEach(p => {
        msg += `- ${p.name} (${p.duration_days} hari) - Rp ${p.price}\n  Status: ${p.is_active ? 'Aktif' : 'Nonaktif'}\n`;
      });
    } else {
      msg += `Belum ada plan.`;
    }
    
    const kb = new InlineKeyboard().text('⬅️ Kembali', 'admin:business');
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('admin:business:coupons', async (ctx: any) => {
    const { data: coupons } = await supabase.from('coupons').select('*');
    let msg = `🎟 COUPONS\n\n`;
    
    if (coupons && coupons.length > 0) {
      coupons.forEach(c => {
        msg += `- [${c.code}] ${c.type === 'percentage' ? c.value + '%' : 'Rp ' + c.value} (Digunakan: ${c.usage_count})\n`;
      });
    } else {
      msg += `Belum ada kupon.`;
    }
    
    const kb = new InlineKeyboard().text('⬅️ Kembali', 'admin:business');
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('admin:business:referrals', async (ctx: any) => {
    const { count: refCount } = await supabase.from('referrals').select('*', { count: 'exact', head: true });
    const { count: rewardedCount } = await supabase.from('referrals').select('*', { count: 'exact', head: true }).eq('status', 'rewarded');
    
    let msg = `👥 REFERRALS & POINTS\n\n`;
    msg += `Total Referrals: ${refCount || 0}\n`;
    msg += `Sukses (Rewarded): ${rewardedCount || 0}\n`;
    
    const kb = new InlineKeyboard().text('⬅️ Kembali', 'admin:business');
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });
};
