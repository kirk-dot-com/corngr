export interface MarketplaceProduct {
    id: string;
    name: string;
    description: string;
    icon: string;
    price: string;
    installed: boolean;
    capabilities: string[]; // e.g., 'schema:medical', 'agent:triage'
}

class MarketplaceStore {
    private products: MarketplaceProduct[] = [];
    private listeners: Set<() => void> = new Set();
    public isLoading = false;
    public error: string | null = null;
    public initialized = false;

    // We must call this component-side or lazily
    async init() {
        if (this.initialized) return;
        this.isLoading = true;
        this.notify();

        try {
            // @ts-ignore
            const { invoke } = window.__TAURI__.core;
            this.products = await invoke('fetch_market_index');
            this.initialized = true;
        } catch (e) {
            console.error("Failed to load marketplace:", e);
            this.error = "Failed to connect to marketplace registry.";
            // Fallback for demo if backend fails (e.g. browser mode)
            this.products = this.getMockFallback();
        } finally {
            this.isLoading = false;
            this.notify();
        }
    }

    getProducts() {
        return this.products;
    }

    async installProduct(id: string) {
        this.isLoading = true;
        this.notify();
        try {
            // @ts-ignore
            const { invoke } = window.__TAURI__.core;
            await invoke('install_package', { packageId: id });

            // Refresh list to update 'installed' status
            this.products = await invoke('fetch_market_index');
        } catch (e) {
            console.error("Install failed:", e);
            this.error = "Installation failed.";
        } finally {
            this.isLoading = false;
            this.notify();
        }
    }

    async uninstallProduct(id: string) {
        this.isLoading = true;
        this.notify();
        try {
            // @ts-ignore
            const { invoke } = window.__TAURI__.core;
            await invoke('uninstall_package', { packageId: id });

            // Refresh list
            this.products = await invoke('fetch_market_index');
        } catch (e) {
            console.error("Uninstall failed:", e);
        } finally {
            this.isLoading = false;
            this.notify();
        }
    }

    hasCapability(capability: string): boolean {
        return this.products.some(p => p.installed && p.capabilities.includes(capability));
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l());
    }
}

export const marketplaceStore = new MarketplaceStore();
