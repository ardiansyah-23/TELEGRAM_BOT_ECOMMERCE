import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../src/database/client';
import { requireAuth } from '../twa/_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    // Verify Admin
    const { data: adminUser } = await supabase
        .from('users')
        .select('is_admin')
        .eq('telegram_id', user.id)
        .single();

    if (!adminUser || !adminUser.is_admin) {
        return res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }

    if (req.method === 'POST') {
        const { product_id, sku, price, stock, is_active } = req.body;
        
        const { data, error } = await supabase
            .from('product_variants')
            .insert([{ product_id, sku, price, stock, is_active }])
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(data);
    }

    if (req.method === 'PATCH') {
        const { id, sku, price, stock, is_active } = req.body;
        
        const { data, error } = await supabase
            .from('product_variants')
            .update({ sku, price, stock, is_active })
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
