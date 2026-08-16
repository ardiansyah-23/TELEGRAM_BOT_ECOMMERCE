import { InlineKeyboard } from 'grammy';
import { supabase } from '../../../database/client';

export const setupAdminCampaignCallback = (bot: any) => {
  bot.callbackQuery('admin:campaigns', async (ctx: any) => {
    let msg = `📢 **CAMPAIGN MANAGEMENT**\n\nMenu ini memungkinkan Anda mengelola Template Pesan, Segmen Target, dan Campaign Marketing.`;
    
    const kb = new InlineKeyboard()
      .text('📝 Templates', 'admin:templates').row()
      .text('👥 Segments', 'admin:segments').row()
      .text('🚀 Campaigns', 'admin:campaign_list').row()
      .text('⬅️ Kembali', 'admin:menu');
      
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('admin:campaign_list', async (ctx: any) => {
    const { data: campaigns } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false }).limit(5);
    
    let msg = `🚀 **CAMPAIGN LIST (Top 5)**\n\n`;
    if (!campaigns || campaigns.length === 0) {
      msg += `Belum ada campaign. (Fitur pembuatan Campaign UI menyusul, gunakan API/Seeder untuk uji coba)`;
    } else {
      campaigns.forEach(c => {
        msg += `- **${c.name}**\n  Status: ${c.status} | Target: ${c.total_target} | Sent: ${c.total_sent}\n`;
      });
    }
    
    const kb = new InlineKeyboard().text('⬅️ Kembali', 'admin:campaigns');
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('admin:templates', async (ctx: any) => {
    const { data: templates } = await supabase.from('message_templates').select('*').order('created_at', { ascending: false }).limit(5);
    let msg = `📝 **MESSAGE TEMPLATES (Top 5)**\n\n`;
    if (!templates || templates.length === 0) {
      msg += `Belum ada template.`;
    } else {
      templates.forEach(t => {
        msg += `- **${t.name}** (${t.type})\n`;
      });
    }
    const kb = new InlineKeyboard().text('⬅️ Kembali', 'admin:campaigns');
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('admin:segments', async (ctx: any) => {
    const { data: segments } = await supabase.from('segments').select('*').order('created_at', { ascending: false }).limit(5);
    let msg = `👥 **SEGMENTS (Top 5)**\n\n`;
    if (!segments || segments.length === 0) {
      msg += `Belum ada segment.`;
    } else {
      segments.forEach(s => {
        msg += `- **${s.name}** (${s.type})\n`;
      });
    }
    const kb = new InlineKeyboard().text('⬅️ Kembali', 'admin:campaigns');
    await ctx.editMessageText(msg, { reply_markup: kb, parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery();
  });
};
