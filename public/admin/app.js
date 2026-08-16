document.addEventListener('alpine:init', () => {
    Alpine.data('adminApp', () => ({
        initData: window.Telegram.WebApp.initData,
        loading: true,
        error: null,
        adminUser: null,
        currentTab: 'dashboard',
        
        navItems: [
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'health', label: 'System Health', icon: '🩺' },
            { id: 'logs', label: 'System Logs', icon: '📝' },
            { id: 'users', label: 'Users', icon: '👥' },
            { id: 'products', label: 'Products', icon: '📦' },
            { id: 'orders', label: 'Orders', icon: '🧾' },
            { id: 'payments', label: 'Payments', icon: '💳' },
            { id: 'campaigns', label: 'Campaigns', icon: '📢' },
            { id: 'tickets', label: 'Support Tickets', icon: '🎫' },
            { id: 'settings', label: 'Settings', icon: '⚙️' }
        ],

        stats: {
            totalUsers: 0,
            premiumUsers: 0,
            pendingOrders: 0,
            revenue: 0,
            scheduler: { pending: 0, failed: 0 },
            botEvents: 0
        },
        healthData: [],
        logsData: [],

        currentData: [], // Stores table data for the active tab

        async init() {
            window.Telegram.WebApp.expand();
            
            if (!this.initData) {
                this.error = "Akses ditolak. Silakan buka melalui Telegram Bot.";
                this.loading = false;
                return;
            }

            try {
                // Fetch stats to verify admin status
                await this.loadData('dashboard');
                
                // Parse basic user info from initData for the UI header
                const urlParams = new URLSearchParams(this.initData);
                const userStr = urlParams.get('user');
                if (userStr) {
                    this.adminUser = JSON.parse(decodeURIComponent(userStr));
                }

                this.loading = false;
            } catch (err) {
                this.error = err.message || "Anda tidak memiliki izin admin.";
                this.loading = false;
            }
        },

        async api(path, options = {}) {
            const headers = {
                'Authorization': `twa ${this.initData}`,
                'Content-Type': 'application/json'
            };
            
            const res = await fetch(`/api/admin${path}`, { ...options, headers });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
            return data;
        },

        async loadData(tab) {
            this.currentData = []; // Clear table while loading
            try {
                if (tab === 'dashboard') {
                    this.stats = await this.api('/stats');
                } else if (tab === 'health') {
                    const res = await this.api('/health');
                    this.healthData = res.components || [];
                } else if (tab === 'logs') {
                    this.logsData = await this.api('/logs?type=logs&limit=50');
                } else if (tab === 'tickets') {
                    this.currentData = await this.api('/tickets');
                } else if (['users', 'products', 'orders', 'payments', 'campaigns'].includes(tab)) {
                    // Placeholder for future endpoints
                    this.currentData = []; // Temp mock
                }
            } catch (err) {
                if (tab === 'dashboard') throw err; // Bubble up for initial auth check
                console.error('Error loading tab data', err);
                alert(err.message);
            }
        },

        getTableColumns() {
            const maps = {
                'users': ['ID', 'Username', 'Name', 'Role', 'Status'],
                'products': ['ID', 'Name', 'Price', 'Stock', 'Status'],
                'orders': ['Order_Number', 'Status', 'Total', 'Created_At'],
                'payments': ['ID', 'Provider', 'Amount', 'Status'],
                'campaigns': ['Name', 'Target', 'Sent', 'Status'],
                'tickets': ['Ticket_Number', 'Subject', 'Status', 'Priority', 'Created_At']
            };
            return maps[this.currentTab] || [];
        }
    }));
});
