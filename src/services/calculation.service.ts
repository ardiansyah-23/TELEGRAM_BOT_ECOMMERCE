export function calculateOrderTotal(subtotal: number, discount: number): number {
    const total = subtotal - discount;
    return total >= 0 ? total : 0;
}

export function calculateDiscount(subtotal: number, coupon: { type: string, value: number, maximum_discount?: number | null }): number {
    let discount = 0;
    
    if (coupon.type === 'percentage') {
        discount = subtotal * (coupon.value / 100);
        if (coupon.maximum_discount && discount > coupon.maximum_discount) {
            discount = coupon.maximum_discount;
        }
    } else if (coupon.type === 'fixed') {
        discount = coupon.value;
    }

    return discount;
}

export function isMembershipActive(expiresAt: string | Date | null): boolean {
    if (!expiresAt) return false;
    const expiry = new Date(expiresAt);
    return expiry.getTime() > Date.now();
}

export function validateCoupon(
    coupon: { is_active: boolean, valid_from: string, valid_until: string, minimum_order: number, usage_limit: number, current_usage: number }, 
    subtotal: number
): { valid: boolean; reason?: string } {
    if (!coupon.is_active) return { valid: false, reason: 'inactive' };
    
    const now = new Date().getTime();
    const validFrom = new Date(coupon.valid_from).getTime();
    const validUntil = new Date(coupon.valid_until).getTime();

    if (now < validFrom) return { valid: false, reason: 'not_started' };
    if (now > validUntil) return { valid: false, reason: 'expired' };

    if (subtotal < coupon.minimum_order) return { valid: false, reason: 'minimum_order' };
    
    if (coupon.usage_limit > 0 && coupon.current_usage >= coupon.usage_limit) {
        return { valid: false, reason: 'usage_limit_reached' };
    }

    return { valid: true };
}
