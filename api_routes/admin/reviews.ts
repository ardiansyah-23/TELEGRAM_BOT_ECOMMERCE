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

    if (req.method === 'GET') {
        const { status } = req.query;

        let query = supabase
            .from('product_reviews')
            .select('*, products(name), users!product_reviews_telegram_id_fkey(full_name, username)')
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status as string);
        }

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
        const { id, status } = req.body;
        
        if (!id || !['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid parameters' });
        }

        const { error } = await supabase
            .from('product_reviews')
            .update({ status })
            .eq('id', id);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
