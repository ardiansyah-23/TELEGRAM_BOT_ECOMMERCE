import { supabase } from '../../database/client';

export class InventoryService {
    
    /**
     * Get available stock for a product or variant
     */
    static async getAvailableStock(product_id: string, variant_id?: string): Promise<number> {
        let query = supabase.from('inventories').select('quantity, reserved_quantity, is_active');
        
        if (variant_id) {
            query = query.eq('variant_id', variant_id);
        } else {
            query = query.eq('product_id', product_id).is('variant_id', null);
        }

        const { data, error } = await query.single();
        if (error || !data || !data.is_active) return 0;
        
        return Math.max(0, data.quantity - data.reserved_quantity);
    }

    /**
     * Release stock reservation (e.g. payment failed / expired)
     */
    static async releaseStock(order_id: string): Promise<boolean> {
        // Find active reservations for this order
        const { data: reservations, error: resError } = await supabase
            .from('inventory_reservations')
            .select('*')
            .eq('order_id', order_id)
            .eq('status', 'active');

        if (resError || !reservations || reservations.length === 0) return false;

        // Note: For full atomicity in production without relying on the client loop,
        // we should ideally use an RPC. For simplicity here, we loop through reservations.
        // It's safe if we only allow the service role or if we have an RPC. 
        // Let's execute via individual RPC calls or direct updates.
        
        for (const res of reservations) {
            // Update inventory reserved quantity
            await supabase.rpc('decrement_reserved_stock', {
                p_inventory_id: res.inventory_id,
                p_quantity: res.quantity
            });
            // (We will need to create decrement_reserved_stock RPC)

            // Log movement
            await supabase.from('inventory_movements').insert([{
                inventory_id: res.inventory_id,
                movement_type: 'release',
                quantity: res.quantity,
                reference_type: 'order',
                reference_id: order_id,
                reason: 'Stock released due to payment failure or expiration',
            }]);

            // Update reservation status
            await supabase.from('inventory_reservations')
                .update({ status: 'released', released_at: new Date().toISOString() })
                .eq('id', res.id);
        }
        
        return true;
    }

    /**
     * Confirm reservation (e.g. payment success)
     */
    static async confirmReservation(order_id: string): Promise<boolean> {
        const { data: reservations, error: resError } = await supabase
            .from('inventory_reservations')
            .select('*')
            .eq('order_id', order_id)
            .eq('status', 'active');

        if (resError || !reservations || reservations.length === 0) return false;

        for (const res of reservations) {
            // Decrease actual quantity AND reserved quantity
            await supabase.rpc('confirm_reserved_stock', {
                p_inventory_id: res.inventory_id,
                p_quantity: res.quantity
            });

            // Log movement (Sale)
            await supabase.from('inventory_movements').insert([{
                inventory_id: res.inventory_id,
                movement_type: 'sale',
                quantity: -res.quantity, // actual deduction
                reference_type: 'order',
                reference_id: order_id,
                reason: 'Stock finalized after payment success',
            }]);

            // Update reservation status
            await supabase.from('inventory_reservations')
                .update({ status: 'confirmed' })
                .eq('id', res.id);
        }

        return true;
    }

    /**
     * Manual Admin Adjustment
     */
    static async adjustStock(inventory_id: string, adjustment: number, reason: string, admin_telegram_id: number): Promise<boolean> {
        if (adjustment === 0) return false;

        const { data: inv, error: invError } = await supabase
            .from('inventories')
            .select('quantity, reserved_quantity')
            .eq('id', inventory_id)
            .single();

        if (invError || !inv) return false;

        if (inv.quantity + adjustment < 0) {
            throw new Error('Stock cannot be negative');
        }

        // RPC to update stock atomically
        const { error } = await supabase.rpc('adjust_inventory_stock', {
            p_inventory_id: inventory_id,
            p_adjustment: adjustment
        });

        if (error) throw new Error(error.message);

        // Log movement
        await supabase.from('inventory_movements').insert([{
            inventory_id,
            movement_type: 'adjustment',
            quantity: adjustment,
            reference_type: 'manual',
            reason,
            created_by: admin_telegram_id
        }]);

        return true;
    }
}
