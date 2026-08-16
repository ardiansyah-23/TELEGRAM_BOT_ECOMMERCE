import { Context, NextFunction } from 'grammy';
import { getUserByTelegramId, createUser, updateUser, updateLastSeen } from '../../database/users';
import { logActivity } from '../../database/logs';

export const autoRegisterAndLogMiddleware = async (ctx: Context, next: NextFunction) => {
  if (ctx.from && ctx.from.id && !ctx.from.is_bot) {
    const telegram_id = ctx.from.id;
    const { username, first_name, last_name, language_code } = ctx.from;
    
    // Check if user exists
    let user = await getUserByTelegramId(telegram_id);
    
    if (!user) {
      // Auto register
      user = await createUser(telegram_id, username, first_name, last_name, language_code);
    } else {
      if (!user.is_active) {
        // User is banned
        return; 
      }
      // Check if profile details changed (simple check)
      if (
        user.username !== (username || null) ||
        user.first_name !== (first_name || null) ||
        user.last_name !== (last_name || null)
      ) {
        await updateUser(telegram_id, {
          username: username || null,
          first_name: first_name || null,
          last_name: last_name || null,
          language_code: language_code || user.language_code
        });
      }
      
      // Update last seen
      await updateLastSeen(telegram_id);
    }
  }

  // Determine action for logging
  let action = 'unknown';
  if (ctx.message?.text) {
    if (ctx.message.text.startsWith('/')) {
      action = ctx.message.text.split(' ')[0]; // Log the command
    } else {
      action = 'message';
    }
  } else if (ctx.callbackQuery) {
    action = `callback:${ctx.callbackQuery.data}`;
  }

  // Log activity if valid user
  if (ctx.from && ctx.from.id) {
    await logActivity(ctx.from.id, action);
  }

  await next();
};
