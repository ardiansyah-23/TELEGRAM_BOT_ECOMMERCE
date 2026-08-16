import type { VercelRequest, VercelResponse } from '@vercel/node';
import { paymentService } from '../../src/services/payment/payment.service';

export default async function handle(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    
    // We intentionally don't await anything that blocks the response for too long
    // However, idempotency and DB updates are fast enough.
    const success = await paymentService.handleWebhook(payload);

    if (success) {
      return res.status(200).json({ status: 'ok' });
    } else {
      // Return 200 anyway to prevent Midtrans from retrying indefinitely if it's an invalid signature
      return res.status(200).json({ status: 'ignored' });
    }
  } catch (error) {
    console.error('Payment webhook error:', error);
    // Returning 500 will make Midtrans retry
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
