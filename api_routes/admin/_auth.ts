import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { supabase } from '../../src/database/client';

export const requireAdminAuth = async (req: VercelRequest, res: VercelResponse) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('twa ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const initData = authHeader.split(' ')[1];
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  const keys = Array.from(urlParams.keys()).sort();
  const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    res.status(500).json({ error: 'Server misconfiguration' });
    return null;
  }

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) {
    res.status(401).json({ error: 'Invalid authentication signature' });
    return null;
  }

  const userStr = urlParams.get('user');
  if (!userStr) {
    res.status(401).json({ error: 'User data missing' });
    return null;
  }

  try {
    const telegramUser = JSON.parse(decodeURIComponent(userStr));
    
    // Check database if user is admin
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('telegram_id, is_admin')
      .eq('telegram_id', telegramUser.id)
      .single();
      
    if (error || !dbUser) {
      res.status(403).json({ error: 'User not found in database' });
      return null;
    }
    
    if (dbUser.is_admin !== true) {
      res.status(403).json({ error: 'Forbidden: Admin access only' });
      return null;
    }

    return telegramUser;
  } catch (e) {
    res.status(401).json({ error: 'Invalid user data format' });
    return null;
  }
};
