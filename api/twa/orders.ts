import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_auth';
import { supabase } from '../../src/database/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const { id } = req.query;
    
    if (id) {
      // Get single order detail
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(name))')
        .eq('id', id)
        .eq('telegram_id', user.id)
        .single();
        
      if (error || !data) return res.status(404).json({ error: 'Order not found' });
      return res.status(200).json(data);
    }
    
    // Get order list
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount, created_at')
      .eq('telegram_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (error) throw error;
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching orders', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
