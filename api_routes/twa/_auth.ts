import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInitData, parseInitDataUser } from '../../src/utils/twaAuth';

export function requireAuth(req: VercelRequest, res: VercelResponse): any | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('twa ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    return null;
  }
  
  const initData = authHeader.replace('twa ', '');
  const botToken = process.env.BOT_TOKEN;
  
  if (!botToken) {
    res.status(500).json({ error: 'Server configuration error' });
    return null;
  }
  
  const isValid = validateInitData(initData, botToken);
  if (!isValid) {
    res.status(403).json({ error: 'Forbidden: Invalid initData signature' });
    return null;
  }
  
  const user = parseInitDataUser(initData);
  if (!user || !user.id) {
    res.status(400).json({ error: 'Bad Request: User data missing in initData' });
    return null;
  }
  
  return user; // { id, first_name, last_name, username, ... }
}
