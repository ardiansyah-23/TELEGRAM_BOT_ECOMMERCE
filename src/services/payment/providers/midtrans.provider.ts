import { PaymentProvider, CreateTransactionResponse, WebhookPayload } from '../payment.provider';
import type { Payment } from '../../../database/types';
import crypto from 'crypto';

export class MidtransProvider implements PaymentProvider {
  name = 'midtrans';
  
  private serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  private isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  private apiUrl = this.isProduction 
    ? 'https://app.midtrans.com/snap/v1/transactions' 
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

  async createTransaction(order_id: string, amount: number, customer_details?: any): Promise<CreateTransactionResponse> {
    if (!this.serverKey) throw new Error('MIDTRANS_SERVER_KEY is not set');

    const authString = Buffer.from(`${this.serverKey}:`).toString('base64');
    
    // We add a unique suffix to the order_id for Midtrans transaction to allow regenerating payment if expired.
    // However, for simplicity and idempotency, we will just pass the internal payment_id or order_id.
    // In this implementation, order_id is used. If we need to regenerate, we might append a timestamp.
    const midtransOrderId = `${order_id}-${Date.now()}`;

    const payload = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: Math.round(amount),
      },
      customer_details,
      // Default 1 hour expiry as discussed
      custom_expiry: {
        expiry_duration: 60,
        unit: 'minute'
      }
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${authString}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Midtrans Error:', errorText);
      throw new Error(`Failed to create Midtrans transaction: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Calculate expiry 60 mins from now
    const expiredAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return {
      transaction_id: midtransOrderId, // we store what we sent to them
      payment_url: data.redirect_url,
      expired_at: expiredAt
    };
  }

  verifyWebhookSignature(payload: WebhookPayload): boolean {
    if (!this.serverKey) return false;
    
    const { order_id, status_code, gross_amount, signature_key } = payload;
    if (!order_id || !status_code || !gross_amount || !signature_key) return false;

    const input = `${order_id}${status_code}${gross_amount}${this.serverKey}`;
    const hash = crypto.createHash('sha512').update(input).digest('hex');

    return hash === signature_key;
  }

  mapStatus(providerStatus: string): Payment['status'] {
    switch (providerStatus.toLowerCase()) {
      case 'capture': // for credit card
      case 'settlement':
        return 'paid';
      case 'pending':
        return 'pending';
      case 'deny':
      case 'cancel':
      case 'failure':
        return 'failed';
      case 'expire':
        return 'expired';
      default:
        return 'pending';
    }
  }
}
