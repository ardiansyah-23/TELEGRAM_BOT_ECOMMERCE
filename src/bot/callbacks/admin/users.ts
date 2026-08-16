import { Bot, InlineKeyboard } from 'grammy';
import { requireAdmin } from '../../middleware/admin';
import { supabase } from '../../../database/client';
import type { MyContext } from '../../types';

export const setupUsersCallback = (bot: any) => {
  
  // Handler for paginated user list
  bot.callbackQuery(/admin:users:(\d+)/, requireAdmin as any, async (ctx: any) => {
    const page = parseInt(ctx.match[1]) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    const { data: users, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!users || users.length === 0) {
      await ctx.answerCallbackQuery('Tidak ada user pada halaman ini.');
      return;
    }

    const totalPages = Math.ceil((count || 0) / limit);

    let msg = `👥 USER MANAGEMENT\n\n`;
    users.forEach((u, i) => {
      msg += `${offset + i + 1}. ${u.first_name || '-'} ${u.username ? '(@' + u.username + ')' : ''}\n`;
    });

    const kb = new InlineKeyboard();
    
    // Pagination buttons
    if (page > 1) kb.text('⬅️', `admin:users:${page - 1}`);
    kb.text(`${page}/${totalPages}`, 'noop');
    if (page < totalPages) kb.text('➡️', `admin:users:${page + 1}`);
    kb.row();
    
    // Detail buttons
    users.forEach((u, i) => {
      kb.text(`Detail #${offset + i + 1}`, `admin:userdetail:${u.telegram_id}`);
    });
    kb.row();
    kb.text('🔎 Cari User', 'admin:search');

    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  // Handler for user detail
  bot.callbackQuery(/admin:userdetail:(\d+)/, requireAdmin as any, async (ctx: any) => {
    const telegram_id = parseInt(ctx.match[1]);
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegram_id)
      .single();

    if (!user) {
      await ctx.answerCallbackQuery('User tidak ditemukan.');
      return;
    }

    const msg = `👤 USER DETAIL\n
ID: ${user.id}
Telegram ID: ${user.telegram_id}
Username: ${user.username ? '@' + user.username : '-'}
Nama: ${user.first_name || '-'} ${user.last_name || ''}
Role: ${user.role}
Status: ${user.is_active ? 'Aktif' : 'Diblokir'}
Terdaftar: ${new Date(user.created_at).toLocaleString('id-ID')}
Terakhir aktif: ${new Date(user.last_seen_at).toLocaleString('id-ID')}`;

    const kb = new InlineKeyboard();
    if (user.is_active) {
      kb.text('🚫 Ban', `admin:ban:${user.telegram_id}`);
    } else {
      kb.text('✅ Unban', `admin:unban:${user.telegram_id}`);
    }
    kb.row();
    kb.text('⬅️ Kembali', 'admin:users:1');

    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });
};
