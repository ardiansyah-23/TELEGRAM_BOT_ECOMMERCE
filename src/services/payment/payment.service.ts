import { PaymentProvider } from './payment.provider';
import { MidtransProvider } from './providers/midtrans.provider';
import { getPaymentByOrderId, createPayment, updatePayment, createPaymentEvent, getPaymentById } from '../../database/payments';
import { getOrderById, updateOrderStatus } from '../../database/orders';
import { supabase } from '../../database/client';
import { getPendingReferral, markReferralRewarded } from '../../database/referrals';
import { processPointTransactionAtomic } from '../../database/points';
import { bot } from '../../bot';
import { InventoryService } from '../inventory/InventoryService';

class PaymentService {
  private provider: PaymentProvider;

  constructor() {
    // Currently hardcoded to Midtrans. Can be made dynamic via env vars.
    this.provider = new MidtransProvider();
  }

  async generatePaymentUrl(order_id: string, telegram_id: number): Promise<{ url: string; payment_id: string }> {
    const orderData = await getOrderById(order_id);
    if (!orderData) throw new Error('Order not found');
    
    if (orderData.order.telegram_id !== telegram_id) throw new Error('Unauthorized');
    if (orderData.order.status !== 'pending') throw new Error('Order is not pending');

    let payment = await getPaymentByOrderId(order_id);

    // If payment exists and not expired, return existing
    if (payment && payment.status === 'pending') {
      if (payment.expired_at && new Date(payment.expired_at) > new Date()) {
        return { url: payment.payment_url!, payment_id: payment.id };
      }
    }

    // Otherwise create new transaction
    const customerDetails = {
      first_name: `TG_USER_${telegram_id}`
    };

    const tx = await this.provider.createTransaction(order_id, orderData.order.total, customerDetails);

    if (payment) {
      // Update existing record with new transaction
      await updatePayment(payment.id, {
        provider_transaction_id: tx.transaction_id,
        payment_url: tx.payment_url,
        expired_at: tx.expired_at,
        status: 'pending'
      });
    } else {
      // Create new record
      const newPayment = await createPayment(order_id, this.provider.name, orderData.order.total);
      if (!newPayment) throw new Error('Failed to create payment record');
      payment = newPayment;
      await updatePayment(payment.id, {
        provider_transaction_id: tx.transaction_id,
        payment_url: tx.payment_url,
        expired_at: tx.expired_at
      });
    }

    return { url: tx.payment_url, payment_id: payment!.id };
  }

  async handleWebhook(payload: any): Promise<boolean> {
    // 1. Verify signature
    if (!this.provider.verifyWebhookSignature(payload)) {
      console.error('Invalid webhook signature');
      return false;
    }

    // 2. Extract data
    const midtransOrderId = payload.order_id; // e.g., UUID-16123456789
    // Extract internal order_id
    const orderIdMatches = midtransOrderId.match(/^([a-f0-9\-]{36})/i);
    if (!orderIdMatches) return false;
    
    const internalOrderId = orderIdMatches[1];
    
    const payment = await getPaymentByOrderId(internalOrderId);
    if (!payment) return false;

    // 3. Idempotency Check
    const eventId = payload.transaction_id || `${midtransOrderId}-${payload.transaction_status}`;
    const isNewEvent = await createPaymentEvent(payment.id, payload.transaction_status, eventId);
    if (!isNewEvent) {
      // Event already processed
      return true;
    }

    // 4. Update status
    const newStatus = this.provider.mapStatus(payload.transaction_status);
    
    // Only update if status changed
    if (payment.status !== newStatus) {
      const updates: any = { status: newStatus };
      if (newStatus === 'paid') updates.paid_at = new Date().toISOString();
      
      await updatePayment(payment.id, updates);

      // 5. Update Order Status & Notify
      const orderData = await getOrderById(payment.order_id);
      if (orderData) {
        if (newStatus === 'paid') {
          await updateOrderStatus(payment.order_id, 'confirmed');
          await this.notifyUser(orderData.order.telegram_id, orderData.order.order_number, true);
          
          // Inventory Confirmation
          if (!orderData.order.order_number.startsWith('SUB-')) {
             await InventoryService.confirmReservation(payment.order_id);
          }

          // Business Logic Injection
          
          // A. Subscription Processing
          if (orderData.order.order_number.startsWith('SUB-')) {
            const parts = orderData.order.order_number.split('-');
            const plan_id_prefix = parts[1]; // We only stored the first part of UUID, so we need to find the plan.
            // Wait, SUB-{plan.id.split('-')[0]}-{Date.now()}
            // Let's get the plan ID matching that prefix
            const { data: plan } = await supabase.from('subscription_plans')
                .select('id').ilike('id', `${plan_id_prefix}-%`).single();
                
            if (plan) {
               await supabase.rpc('apply_subscription_payment', {
                 p_telegram_id: orderData.order.telegram_id,
                 p_plan_id: plan.id
               });
               await bot.api.sendMessage(orderData.order.telegram_id, `💎 Membership Premium Anda telah aktif/diperpanjang!`);
            }
          } else {
            // B. E-Commerce Order - check for referral reward on first purchase
            const pendingRef = await getPendingReferral(orderData.order.telegram_id);
            if (pendingRef) {
               const marked = await markReferralRewarded(pendingRef.id);
               if (marked) {
                 await processPointTransactionAtomic(
                    pendingRef.referrer_telegram_id, 
                    'credit', 
                    100, // reward points
                    'referral', 
                    pendingRef.id, 
                    'Bonus referral pengguna baru melakukan pembelian pertama'
                 );
                 await bot.api.sendMessage(pendingRef.referrer_telegram_id, `🎉 Selamat! Teman yang Anda undang telah menyelesaikan pembelian pertama. Anda mendapatkan 100 Poin!`);
               }
            }
          }
        } else if (newStatus === 'failed') {
          await this.notifyUser(orderData.order.telegram_id, orderData.order.order_number, false);
          if (!orderData.order.order_number.startsWith('SUB-')) {
             await InventoryService.releaseStock(payment.order_id);
          }
        } else if (newStatus === 'expired') {
          await this.notifyUser(orderData.order.telegram_id, orderData.order.order_number, false, true);
          if (!orderData.order.order_number.startsWith('SUB-')) {
             await InventoryService.releaseStock(payment.order_id);
          }
        }
      }
    }

    return true;
  }

  private async notifyUser(telegram_id: number, order_number: string, isSuccess: boolean, isExpired = false) {
    try {
      if (isSuccess) {
        await bot.api.sendMessage(telegram_id, `✅ PEMBAYARAN BERHASIL\n\nOrder: ${order_number}\nStatus: Pembayaran berhasil.\n\nTerima kasih atas pesanan Anda.`);
      } else if (isExpired) {
        await bot.api.sendMessage(telegram_id, `❌ PEMBAYARAN KEDALUWARSA\n\nOrder: ${order_number}\n\nSilakan buka menu Pesanan Saya untuk membuat pembayaran baru.`);
      } else {
        await bot.api.sendMessage(telegram_id, `❌ PEMBAYARAN GAGAL\n\nOrder: ${order_number}\n\nSilakan coba pembayaran kembali melalui menu Pesanan Saya.`);
      }
    } catch (e) {
      console.error('Failed to send notification to user', e);
    }
  }
}

export const paymentService = new PaymentService();
