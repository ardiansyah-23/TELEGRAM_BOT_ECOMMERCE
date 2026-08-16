const tg = window.Telegram.WebApp;
tg.expand(); // Expand app to maximum height

const App = {
    initData: tg.initData,
    user: null,
    cart: [],
    products: [],
    
    async init() {
        if (!this.initData) {
            this.showError("Gagal memuat profil. Silakan buka melalui Telegram.");
            return;
        }

        // Setup Navigation
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.currentTarget.dataset.tab));
        });

        // Setup Telegram Main Button
        tg.MainButton.onClick(() => this.handleMainButton());

        await this.loadProfile();
        this.switchTab('home');
    },

    async api(path, options = {}) {
        const headers = {
            'Authorization': `twa ${this.initData}`,
            'Content-Type': 'application/json'
        };
        
        try {
            const res = await fetch(`/api/twa${path}`, { ...options, headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
            return data;
        } catch (e) {
            console.error(e);
            tg.showAlert(e.message);
            throw e;
        }
    },

    async loadProfile() {
        this.showLoading();
        try {
            const data = await this.api('/me');
            this.user = data.user;
            
            document.getElementById('userName').innerText = `👋 Halo, ${this.user.first_name}`;
            
            // Assume we had membership info in user (we'll just show mock logic based on user data for now)
            document.getElementById('userMembership').innerText = `💎 Regular`; // Normally mapped from API
            document.getElementById('userPoints').innerText = `💰 0 Poin`; // Normally mapped from API
        } catch (e) {
            // Error handled in api()
        } finally {
            this.hideLoading();
        }
    },

    async loadProducts() {
        this.showLoading();
        try {
            this.products = await this.api('/products');
            const container = document.getElementById('productList');
            container.innerHTML = '';
            
            this.products.forEach(p => {
                const el = document.createElement('div');
                el.className = 'product-item';
                el.onclick = () => this.showProductDetail(p);
                
                el.innerHTML = `
                    <h3>${p.name}</h3>
                    <p class="price">Rp ${p.price.toLocaleString('id-ID')}</p>
                    <p class="stock">Stok: ${p.stock}</p>
                `;
                container.appendChild(el);
            });
        } finally {
            this.hideLoading();
        }
    },

    async loadCart() {
        this.showLoading();
        try {
            this.cart = await this.api('/cart');
            this.renderCart();
        } finally {
            this.hideLoading();
        }
    },

    renderCart() {
        const container = document.getElementById('cartList');
        const emptyState = document.getElementById('cartEmpty');
        const summary = document.getElementById('cartSummary');
        const subtotalEl = document.getElementById('cartSubtotal');
        
        container.innerHTML = '';
        
        if (!this.cart || this.cart.length === 0) {
            emptyState.style.display = 'block';
            summary.style.display = 'none';
            tg.MainButton.hide();
            return;
        }
        
        emptyState.style.display = 'none';
        summary.style.display = 'block';
        
        let total = 0;
        
        this.cart.forEach(item => {
            total += item.quantity * item.products.price;
            
            const el = document.createElement('div');
            el.className = 'cart-item';
            
            el.innerHTML = `
                <div>
                    <h3 style="margin:0; font-size:14px;">${item.products.name}</h3>
                    <p class="price" style="font-size:12px;">Rp ${item.products.price.toLocaleString('id-ID')}</p>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="app.updateCart('${item.id}', ${item.quantity - 1})">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="app.updateCart('${item.id}', ${item.quantity + 1})">+</button>
                </div>
            `;
            container.appendChild(el);
        });
        
        subtotalEl.innerText = `Rp ${total.toLocaleString('id-ID')}`;
    },

    async updateCart(id, quantity) {
        tg.HapticFeedback.impactOccurred('light');
        if (quantity < 0) return;
        
        this.showLoading();
        try {
            if (quantity === 0) {
                await this.api(`/cart?id=${id}`, { method: 'DELETE' });
            } else {
                await this.api('/cart', {
                    method: 'PATCH',
                    body: JSON.stringify({ id, quantity })
                });
            }
            await this.loadCart();
        } finally {
            this.hideLoading();
        }
    },

    async loadOrders() {
        this.showLoading();
        try {
            const orders = await this.api('/orders');
            const container = document.getElementById('orderList');
            container.innerHTML = '';
            
            if (orders.length === 0) {
                container.innerHTML = '<div class="empty-state">Belum ada pesanan.</div>';
                return;
            }
            
            orders.forEach(o => {
                const el = document.createElement('div');
                el.className = 'order-item';
                
                el.innerHTML = `
                    <div class="order-header">
                        <strong>${o.order_number}</strong>
                        <span class="status">${o.status}</span>
                    </div>
                    <div>Total: <span class="price">Rp ${o.total_amount.toLocaleString('id-ID')}</span></div>
                    <div style="font-size:12px; color:var(--hint-color); margin-top:4px;">
                        ${new Date(o.created_at).toLocaleDateString('id-ID')}
                    </div>
                `;
                container.appendChild(el);
            });
        } finally {
            this.hideLoading();
        }
    },

    async loadSettings() {
        this.showLoading();
        try {
            const prefs = await this.api('/settings');
            const container = document.getElementById('notificationSettings');
            container.innerHTML = '';
            
            const renderToggle = (key, label, value) => {
                return `
                    <div class="setting-item">
                        <span>${label}</span>
                        <label class="switch">
                            <input type="checkbox" ${value ? 'checked' : ''} onchange="app.updateSetting('${key}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </div>
                `;
            };
            
            container.innerHTML = `
                ${renderToggle('order_notifications', 'Notifikasi Pesanan', prefs.order_notifications)}
                ${renderToggle('payment_notifications', 'Notifikasi Pembayaran', prefs.payment_notifications)}
                ${renderToggle('membership_notifications', 'Notifikasi Membership', prefs.membership_notifications)}
                ${renderToggle('campaign_notifications', 'Notifikasi Promo/Campaign', prefs.campaign_notifications)}
            `;
        } finally {
            this.hideLoading();
        }
    },

    async updateSetting(key, value) {
        tg.HapticFeedback.impactOccurred('light');
        try {
            const body = {};
            body[key] = value;
            await this.api('/settings', {
                method: 'PATCH',
                body: JSON.stringify(body)
            });
        } catch (e) {
            // Revert UI if fail
            this.loadSettings();
        }
    },

    showProductDetail(product) {
        this.currentProduct = product;
        document.getElementById('modalProductName').innerText = product.name;
        document.getElementById('modalProductPrice').innerText = `Rp ${product.price.toLocaleString('id-ID')}`;
        document.getElementById('modalProductStock').innerText = `Stok: ${product.stock}`;
        document.getElementById('modalProductDesc').innerText = product.description || 'Tidak ada deskripsi.';
        
        document.getElementById('productModal').style.display = 'block';
    },

    closeModal() {
        document.getElementById('productModal').style.display = 'none';
        this.currentProduct = null;
    },

    async addToCart() {
        if (!this.currentProduct) return;
        tg.HapticFeedback.impactOccurred('medium');
        
        const btn = document.getElementById('modalAddToCart');
        btn.innerText = 'Menambahkan...';
        btn.disabled = true;
        
        try {
            await this.api('/cart', {
                method: 'POST',
                body: JSON.stringify({ product_id: this.currentProduct.id, quantity: 1 })
            });
            this.closeModal();
            tg.showAlert('Berhasil ditambahkan ke keranjang!');
            
            // If already on cart tab, reload it
            if (document.getElementById('cart').classList.contains('active')) {
                this.loadCart();
            }
        } finally {
            btn.innerText = '🛒 Tambah ke Keranjang';
            btn.disabled = false;
        }
    },

    async checkout() {
        tg.HapticFeedback.impactOccurred('heavy');
        this.showLoading();
        try {
            const result = await this.api('/checkout', { method: 'POST' });
            
            if (result.payment_url) {
                // Open payment link via Telegram
                tg.openLink(result.payment_url);
                tg.close(); // Close WebApp
            }
        } finally {
            this.hideLoading();
        }
    },

    switchTab(tabId) {
        tg.HapticFeedback.impactOccurred('light');
        
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        
        // Show target
        document.getElementById(tabId).classList.add('active');
        const navBtn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
        if (navBtn) navBtn.classList.add('active');
        
        // Trigger specific loads
        if (tabId === 'products' && this.products.length === 0) this.loadProducts();
        if (tabId === 'cart') this.loadCart();
        if (tabId === 'orders') this.loadOrders();
        if (tabId === 'settings') this.loadSettings();
    },

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    },

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    },

    showError(msg) {
        document.body.innerHTML = `<div class="empty-state">${msg}</div>`;
    }
};

// Initialize
window.app = App;
tg.ready();
App.init();
