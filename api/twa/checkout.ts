import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_auth';
import { supabase } from '../../src/database/client';
import { checkoutCartAtomic, getOrderById } from '../../src/database/orders';
import { paymentService } from '../../src/services/payment/payment.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const { voucher_code, order_note } = req.body || {};
    
    // Create order using atomic RPC
    const order_number = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const order_id = await checkoutCartAtomic(user.id, order_number, order_note);
    
    if (!order_id) {
      return res.status(400).json({ error: 'Gagal membuat pesanan. Keranjang mungkin kosong atau stok habis.' });
    }
    
    // Generate payment link using payment service
    const payment = await paymentService.generatePaymentUrl(order_id, user.id);
    
    const orderData = await getOrderById(order_id);
    
    res.status(200).json({ 
      order: orderData?.order, 
      payment_url: payment.url 
    });
  } catch (error: any) {
    console.error('Error in /api/twa/checkout', error);
    res.status(400).json({ error: error.message || 'Internal Server Error' });
  }
}
