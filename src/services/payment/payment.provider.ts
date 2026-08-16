import type { Payment } from '../../database/types';

export interface CreateTransactionResponse {
  transaction_id: string;
  payment_url: string;
  expired_at: string;
}

export interface WebhookPayload {
  [key: string]: any;
}

export interface PaymentProvider {
  /**
   * Nama provider, misal: 'midtrans'
   */
  name: string;

  /**
   * Membuat transaksi di sisi provider dan mengembalikan URL pembayaran
   */
  createTransaction(order_id: string, amount: number, customer_details?: any): Promise<CreateTransactionResponse>;

  /**
   * Memverifikasi keaslian webhook berdasarkan signature
   */
  verifyWebhookSignature(payload: WebhookPayload): boolean;

  /**
   * Memetakan status dari provider ke status internal kita
   */
  mapStatus(providerStatus: string): Payment['status'];
}
