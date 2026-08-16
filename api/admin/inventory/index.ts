import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../src/database/client';
import { requireAuth } from '../../twa/_auth';

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
        const { stats } = req.query;

        if (stats) {
            // Calculate stats
            const { data: invs, error } = await supabase.from('inventories').select('quantity, reserved_quantity, low_stock_threshold');
            if (error) return res.status(500).json({ error: error.message });

            let totalStock = 0;
            let totalReserved = 0;
            let lowStockCount = 0;
            let outOfStockCount = 0;

            invs.forEach(inv => {
                totalStock += inv.quantity;
                totalReserved += inv.reserved_quantity;
                const available = inv.quantity - inv.reserved_quantity;
                if (available <= 0) outOfStockCount++;
                else if (available <= inv.low_stock_threshold) lowStockCount++;
            });

            return res.status(200).json({
                total_products: invs.length,
                total_stock: totalStock,
                reserved_stock: totalReserved,
                available_stock: totalStock - totalReserved,
                low_stock_count: lowStockCount,
                out_of_stock_count: outOfStockCount
            });
        }

        // List
        const { data, error } = await supabase
            .from('inventories')
            .select(`
                *,
                products(name),
                product_variants(sku, product_variant_values(product_option_values(value, product_options(name))))
            `)
            .order('updated_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
