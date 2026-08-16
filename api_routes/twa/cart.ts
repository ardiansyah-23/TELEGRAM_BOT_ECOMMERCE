import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_auth';
import { supabase } from '../../src/database/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *, 
          products(name, price, stock, is_active),
          product_variants(price, stock, sku, is_active, product_variant_values(product_option_values(value, product_options(name))))
        `)
        .eq('telegram_id', user.id);
        
      if (error) throw error;
      return res.status(200).json(data);
    } 
    
    else if (req.method === 'POST') {
      const { product_id, variant_id, quantity = 1 } = req.body;
      if (!product_id) return res.status(400).json({ error: 'Missing product_id' });
      
      let stock = 0;
      let active = false;

      if (variant_id) {
        const { data: variant } = await supabase.from('product_variants').select('stock, is_active').eq('id', variant_id).single();
        if (!variant) return res.status(400).json({ error: 'Variant not found' });
        stock = variant.stock;
        active = variant.is_active;
      } else {
        const { data: product } = await supabase.from('products').select('stock, is_active').eq('id', product_id).single();
        if (!product) return res.status(400).json({ error: 'Product not found' });
        stock = product.stock;
        active = product.is_active;
      }

      if (!active) {
        return res.status(400).json({ error: 'Item tidak aktif' });
      }

      if (stock < quantity) {
        return res.status(400).json({ error: 'Stok tidak mencukupi' });
      }

      // Check if already in cart
      let query = supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('telegram_id', user.id)
        .eq('product_id', product_id);
      
      if (variant_id) {
        query = query.eq('variant_id', variant_id);
      } else {
        query = query.is('variant_id', null);
      }
      
      const { data: existing } = await query.maybeSingle();
        
      if (existing) {
        const newQty = existing.quantity + quantity;
        if (newQty > stock) return res.status(400).json({ error: 'Melebihi batas stok' });
        
        const { data } = await supabase.from('cart_items').update({ quantity: newQty }).eq('id', existing.id).select().single();
        return res.status(200).json(data);
      } else {
        const { data } = await supabase.from('cart_items').insert([{ 
          telegram_id: user.id, 
          product_id, 
          variant_id: variant_id || null, 
          quantity 
        }]).select().single();
        return res.status(201).json(data);
      }
    }
    
    else if (req.method === 'PATCH') {
      const { id, quantity } = req.body;
      if (!id || quantity === undefined) return res.status(400).json({ error: 'Missing id or quantity' });
      
      if (quantity <= 0) {
        await supabase.from('cart_items').delete().eq('id', id).eq('telegram_id', user.id);
        return res.status(200).json({ deleted: true });
      }
      
      // Get item to check stock
      const { data: item } = await supabase.from('cart_items').select('product_id, variant_id').eq('id', id).eq('telegram_id', user.id).single();
      if (!item) return res.status(404).json({ error: 'Not found in cart' });

      let stock = 0;
      if (item.variant_id) {
        const { data: v } = await supabase.from('product_variants').select('stock').eq('id', item.variant_id).single();
        stock = v?.stock || 0;
      } else {
        const { data: p } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
        stock = p?.stock || 0;
      }

      if (quantity > stock) return res.status(400).json({ error: 'Stok tidak mencukupi' });

      const { data } = await supabase.from('cart_items').update({ quantity }).eq('id', id).eq('telegram_id', user.id).select().single();
      return res.status(200).json(data);
    }
    
    else if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      
      await supabase.from('cart_items').delete().eq('id', id).eq('telegram_id', user.id);
      return res.status(200).json({ deleted: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in /api/twa/cart', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
