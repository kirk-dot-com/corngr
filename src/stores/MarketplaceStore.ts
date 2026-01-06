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
            // @ts-ignore
            const tauriInvoke = window.__TAURI__?.core?.invoke || invoke;

            // 1. Fetch from Registry (Index)
            const remoteProducts: MarketplaceProduct[] = await tauriInvoke('fetch_market_index');

            // 2. Fetch Installed Extensions (Disk)
            // This ensures we have capabilities even if the registry is offline or products were removed from registry
            const installedManifests: any[] = await tauriInvoke('get_installed_extensions');

            // 3. Merge Strategies
            // Start with remote products
            let finalProducts = [...remoteProducts];

            // Add installed products that might not be in the registry index anymore (Sideloaded / Deprecated)
            installedManifests.forEach(manifest => {
                const existing = finalProducts.find(p => p.id === manifest.id);
                if (existing) {
                    existing.installed = true;
                    // Ensure capabilities match manifest (truth on disk wins)
                    existing.capabilities = manifest.capabilities;
                } else {
                    // Add as a local-only product
                    finalProducts.push({
                        id: manifest.id,
                        name: manifest.name,
                        description: manifest.description,
                        icon: '📦', // Default icon for unknown source
                        price: 'Installed',
                        installed: true,
                        capabilities: manifest.capabilities
                    });
                }
            });

            this.products = finalProducts;
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
