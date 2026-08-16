import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_auth';
import { supabase } from '../../src/database/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const { product_id } = req.query;
      
      let query = supabase
        .from('product_reviews')
        .select('*, users(first_name, username)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
        
      if (product_id) {
        query = query.eq('product_id', product_id as string);
      } else {
        // User's own reviews
        query = supabase
          .from('product_reviews')
          .select('*, products(name)')
          .eq('telegram_id', user.id)
          .order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data);
    } 
    
    else if (req.method === 'POST') {
      const { product_id, order_id, rating, title, review } = req.body;
      
      if (!product_id || !order_id || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Missing or invalid fields' });
      }
      
      // Verify eligibility: User must own the order and the order must contain the product
      const { data: orderItem } = await supabase
        .from('order_items')
        .select('id, orders!inner(telegram_id, status)')
        .eq('order_id', order_id)
        .eq('product_id', product_id)
        .eq('orders.telegram_id', user.id)
        .in('orders.status', ['completed', 'processing']) // Assume eligible if paid/processing
        .maybeSingle();

      if (!orderItem) {
        return res.status(403).json({ error: 'Tidak memenuhi syarat untuk mengulas produk ini' });
      }
      
      const { data, error } = await supabase
        .from('product_reviews')
        .insert([{ 
          product_id, 
          telegram_id: user.id, 
          order_id, 
          rating, 
          title, 
          review,
          status: 'pending' // Moderation
        }])
        .select()
        .single();
        
      if (error) {
        if (error.code === '23505') { 
          return res.status(400).json({ error: 'Anda sudah mengulas produk ini untuk pesanan ini' });
        }
        throw error;
      }
      
      return res.status(201).json(data);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in /api/twa/reviews', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
