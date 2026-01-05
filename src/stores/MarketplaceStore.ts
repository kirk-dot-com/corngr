import { invoke } from '@tauri-apps/api/core';

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
            // Use window.__TAURI__.core.invoke if module import fails or mock fallback
            // But we can try to use the imported invoke if available. 
            // The codebase seems to use window.__TAURI__ usually.
            // @ts-ignore
            const tauriInvoke = window.__TAURI__?.core?.invoke || invoke;

            this.products = await tauriInvoke('fetch_market_index');
            this.initialized = true;
        } catch (e) {
            console.error("Failed to load marketplace:", e);
            this.error = "Failed to connect to marketplace registry.";
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
            const tauriInvoke = window.__TAURI__?.core?.invoke || invoke;
            await tauriInvoke('install_package', { packageId: id });

            // Refresh list to update 'installed' status
            this.products = await tauriInvoke('fetch_market_index');
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
            const tauriInvoke = window.__TAURI__?.core?.invoke || invoke;
            await tauriInvoke('uninstall_package', { packageId: id });

            // Refresh list
            this.products = await tauriInvoke('fetch_market_index');
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

    private getMockFallback(): MarketplaceProduct[] {
        return [
            {
                id: 'prod_medical',
                name: 'Clinician Suite (Offline)',
                description: 'Medical record blocks.',
                icon: '🩺',
                price: '$29/mo',
                installed: false,
                capabilities: []
            }
        ];
    }
}

export const marketplaceStore = new MarketplaceStore();
