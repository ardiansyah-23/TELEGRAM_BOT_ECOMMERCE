import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_auth';
import { supabase } from '../../src/database/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('wishlists')
        .select('*, products(name, price, stock, is_active, category_id, categories(name))')
        .eq('telegram_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return res.status(200).json(data);
    } 
    
    else if (req.method === 'POST') {
      const { product_id } = req.body;
      if (!product_id) return res.status(400).json({ error: 'Missing product_id' });
      
      const { data, error } = await supabase
        .from('wishlists')
        .insert([{ telegram_id: user.id, product_id }])
        .select()
        .single();
        
      if (error) {
        if (error.code === '23505') { // Unique violation
          return res.status(200).json({ message: 'Already in wishlist' });
        }
        throw error;
      }
      return res.status(201).json(data);
    }
    
    else if (req.method === 'DELETE') {
      const { product_id } = req.query;
      if (!product_id) return res.status(400).json({ error: 'Missing product_id' });
      
      await supabase
        .from('wishlists')
        .delete()
        .eq('product_id', product_id)
        .eq('telegram_id', user.id);
        
      return res.status(200).json({ deleted: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in /api/twa/wishlists', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
