import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_auth';
import { supabase } from '../../src/database/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = requireAuth(req, res);
  if (!user) return; // Response already handled in requireAuth

  try {
    // Get user details from DB
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', user.id)
      .single();
      
    if (error) {
      // If user isn't in DB yet, auto-register them
      const newUser = {
        telegram_id: user.id,
        first_name: user.first_name,
        username: user.username,
        is_active: true
      };
      const { data: inserted } = await supabase.from('users').insert([newUser]).select().single();
      
      return res.status(200).json({
        user: inserted,
        telegramData: user
      });
    }

    res.status(200).json({
      user: dbUser,
      telegramData: user
    });
  } catch (error) {
    console.error('Error in /api/twa/me', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
