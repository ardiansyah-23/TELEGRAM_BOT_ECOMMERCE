import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../src/database/client';
import { requireAuth } from '../../twa/_auth';
import { InventoryService } from '../../../src/services/inventory/InventoryService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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

    try {
        const { inventory_id, adjustment, reason } = req.body;
        
        if (!inventory_id || adjustment === undefined || !reason) {
            return res.status(400).json({ error: 'Missing fields' });
        }

        await InventoryService.adjustStock(inventory_id, parseInt(adjustment, 10), reason, user.id);
        
        return res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Adjust stock error:', error);
        return res.status(400).json({ error: error.message || 'Failed to adjust stock' });
    }
}
