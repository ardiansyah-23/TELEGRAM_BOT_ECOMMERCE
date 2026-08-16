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
    const { category, search, sort, page = '1', limit = '20', product_id } = req.query;

    // Track recently viewed if accessing specific product
    if (product_id) {
      await supabase.from('recently_viewed_products').upsert({
        telegram_id: user.id,
        product_id: product_id as string,
        last_viewed_at: new Date().toISOString()
      }, { onConflict: 'telegram_id,product_id' });

      // Fetch single product with variants and options
      const { data: product, error } = await supabase
        .from('products')
        .select(`
          id, name, description, price, image_url, category_id, created_at,
          categories(name),
          product_variants(id, sku, price),
          product_options(id, name, product_option_values(id, value))
        `)
        .eq('id', product_id as string)
        .eq('is_active', true)
        .single();
        
      if (error || !product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Fetch reviews stats
      const { data: reviews } = await supabase
        .from('product_reviews')
        .select('rating')
        .eq('product_id', product_id as string)
        .eq('status', 'approved');
      
      const rating = reviews && reviews.length > 0 
        ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1)
        : null;

      // Fetch related products
      const { data: related } = await supabase
        .from('products')
        .select('id, name, price, stock')
        .eq('category_id', product.category_id)
        .eq('is_active', true)
        .neq('id', product_id as string)
        .limit(4);

      return res.status(200).json({ ...product, rating, reviews_count: reviews?.length || 0, related });
    }

    // List products
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('products')
      .select('id, name, description, price, image_url, category_id, categories(name)', { count: 'exact' })
      .eq('is_active', true);
    
    if (category) query = query.eq('category_id', category as string);
    if (search) query = query.ilike('name', `%${search}%`);

    switch (sort) {
      case 'price_low': query = query.order('price', { ascending: true }); break;
      case 'price_high': query = query.order('price', { ascending: false }); break;
      case 'newest': query = query.order('created_at', { ascending: false }); break;
      default: query = query.order('created_at', { ascending: false }); break;
    }

    const { data: products, count, error } = await query.range(offset, offset + limitNum - 1);
    
    if (error) throw error;

    res.status(200).json({
      data: products,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: count ? Math.ceil(count / limitNum) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching products', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
