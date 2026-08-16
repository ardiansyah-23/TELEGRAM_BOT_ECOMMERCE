export const mockUser = {
    telegram_id: 123456789,
    username: 'testuser',
    full_name: 'Test User',
    language_code: 'id',
    membership_level: 'free',
    membership_expires_at: null,
};

export const mockPremiumUser = {
    ...mockUser,
    telegram_id: 987654321,
    membership_level: 'premium',
    membership_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

export const mockProduct = {
    id: 'prod-1',
    name: 'Produk A',
    description: 'Deskripsi Produk A',
    price: 150000,
    stock: 10,
    category_id: 'cat-1',
    is_active: true
};

export const mockCoupon = {
    id: 'coup-1',
    code: 'DISKON10',
    type: 'percentage', // percentage | fixed
    value: 10, // 10%
    minimum_order: 100000,
    maximum_discount: 20000,
    usage_limit: 100,
    per_user_limit: 1,
    valid_from: new Date(Date.now() - 10000).toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    is_active: true
};
