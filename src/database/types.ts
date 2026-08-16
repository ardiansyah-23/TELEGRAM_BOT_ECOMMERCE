export type Role = 'user' | 'admin';

export interface User {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  timezone: string;
  is_admin: boolean;
  is_active: boolean;
  membership_level: 'free' | 'premium';
  membership_started_at: string | null;
  membership_expires_at: string | null;
  referral_code: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
}

export interface ActivityLog {
  id: string;
  telegram_id: number;
  action: string;
  metadata: any | null;
  created_at: string;
}

export interface Broadcast {
  id: string;
  admin_telegram_id: number;
  message_type: string;
  target: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total_target: number;
  total_sent: number;
  total_failed: number;
  created_at: string;
  completed_at: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Included from join
  categories?: { name: string };
}

export interface CartItem {
  id: string;
  telegram_id: number;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  // Included from join
  products?: Product;
}

export interface Order {
  id: string;
  order_number: string;
  telegram_id: number;
  status: 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
  subtotal: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  price: number;
  quantity: number;
  subtotal: number;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  provider: string;
  provider_transaction_id: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';
  payment_url: string | null;
  expired_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  orders?: Order;
}

export interface PaymentEvent {
  id: string;
  payment_id: string;
  event_type: string;
  provider_event_id: string;
  payload_hash: string | null;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  duration_days: number;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  referrer_telegram_id: number;
  referred_telegram_id: number;
  status: 'pending' | 'rewarded';
  rewarded_at: string | null;
  created_at: string;
}

export interface Wallet {
  telegram_id: number;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface PointTransaction {
  id: string;
  telegram_id: number;
  type: 'credit' | 'debit';
  amount: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minimum_order: number;
  maximum_discount: number | null;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CouponUsage {
  id: string;
  coupon_id: string;
  telegram_id: number;
  order_id: string;
  discount_amount: number;
  created_at: string;
}

export interface ScheduledJob {
  id: string;
  type: 'reminder' | 'scheduled_message' | 'membership_expiration' | 'payment_expiration' | 'order_notification' | 'broadcast' | 'campaign';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  run_at: string;
  payload: any;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  locked_at: string | null;
  completed_at: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreference {
  telegram_id: number;
  order_notifications: boolean;
  payment_notifications: boolean;
  membership_notifications: boolean;
  reward_notifications: boolean;
  campaign_notifications: boolean;
  system_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  type: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  type: string;
  rules: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  template_id: string;
  segment_id: string;
  status: 'draft' | 'scheduled' | 'processing' | 'completed' | 'cancelled' | 'failed';
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_target: number;
  total_sent: number;
  total_failed: number;
  total_skipped: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  telegram_id: number;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
}

