import { describe, it, expect } from 'vitest';
import { 
    calculateOrderTotal, 
    calculateDiscount, 
    isMembershipActive, 
    validateCoupon 
} from '../../src/services/calculation.service';
import { mockCoupon } from '../fixtures/mockData';

describe('Calculation Service', () => {
    describe('calculateOrderTotal', () => {
        it('should correctly subtract discount from subtotal', () => {
            expect(calculateOrderTotal(100000, 10000)).toBe(90000);
        });

        it('should not return negative total', () => {
            expect(calculateOrderTotal(10000, 20000)).toBe(0);
        });
    });

    describe('calculateDiscount', () => {
        it('should calculate percentage discount correctly', () => {
            const discount = calculateDiscount(100000, { type: 'percentage', value: 10 });
            expect(discount).toBe(10000);
        });

        it('should cap percentage discount to maximum_discount if provided', () => {
            const discount = calculateDiscount(1000000, { type: 'percentage', value: 10, maximum_discount: 20000 });
            expect(discount).toBe(20000); // 10% of 1m is 100k, capped to 20k
        });

        it('should calculate fixed discount correctly', () => {
            const discount = calculateDiscount(50000, { type: 'fixed', value: 15000 });
            expect(discount).toBe(15000);
        });
    });

    describe('isMembershipActive', () => {
        it('should return true for future dates', () => {
            const future = new Date(Date.now() + 86400000); // +1 day
            expect(isMembershipActive(future)).toBe(true);
        });

        it('should return false for past dates', () => {
            const past = new Date(Date.now() - 86400000); // -1 day
            expect(isMembershipActive(past)).toBe(false);
        });

        it('should return false if expiresAt is null', () => {
            expect(isMembershipActive(null)).toBe(false);
        });
    });

    describe('validateCoupon', () => {
        const baseCoupon = {
            is_active: true,
            valid_from: new Date(Date.now() - 10000).toISOString(),
            valid_until: new Date(Date.now() + 86400000).toISOString(),
            minimum_order: 50000,
            usage_limit: 100,
            current_usage: 10
        };

        it('should be valid for proper conditions', () => {
            const result = validateCoupon(baseCoupon, 60000);
            expect(result.valid).toBe(true);
        });

        it('should return invalid if inactive', () => {
            const result = validateCoupon({ ...baseCoupon, is_active: false }, 60000);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('inactive');
        });

        it('should return invalid if minimum order not met', () => {
            const result = validateCoupon(baseCoupon, 40000); // less than 50k
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('minimum_order');
        });

        it('should return invalid if expired', () => {
            const result = validateCoupon({ ...baseCoupon, valid_until: new Date(Date.now() - 10000).toISOString() }, 60000);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('expired');
        });

        it('should return invalid if usage limit reached', () => {
            const result = validateCoupon({ ...baseCoupon, current_usage: 100 }, 60000);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('usage_limit_reached');
        });
    });
});
