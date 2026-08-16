import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdminAuth } from './_auth';
import { supabase } from '../../src/database/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authUser = await requireAdminAuth(req, res);
  if (!authUser) return; // Response is already handled

  const type = req.query.type as string; // 'logs' or 'alerts'
  const limit = parseInt(req.query.limit as string) || 50;

  try {
    if (type === 'alerts') {
      const { data, error } = await supabase.from('system_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return res.status(200).json(data);
    } else {
      const { data, error } = await supabase.from('system_logs')
        .select('id, level, action, message, created_at, request_id, actor')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return res.status(200).json(data);
    }
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve logs' });
  }
}
