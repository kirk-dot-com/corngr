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
    private products: MarketplaceProduct[] = [
        {
            id: 'prod_medical',
            name: 'Clinician Suite',
            description: 'Medical record blocks, triage agents, and HL7 schema extensions.',
            icon: '🩺',
            price: '$29/mo',
            installed: false,
            capabilities: ['schema:medical', 'block:symptom', 'agent:triage']
        },
        {
            id: 'prod_legal',
            name: 'Legal Audit Pack',
            description: 'Contract clause blocks and risk assessment governance tools.',
            icon: '⚖️',
            price: '$99/mo',
            installed: false,
            capabilities: ['schema:legal', 'block:clause', 'agent:audit']
        },
        {
            id: 'prod_jira',
            name: 'Jria Sync Integration',
            description: 'Bi-directional sync with Atlassian Jria issues.',
            icon: '🔄',
            price: '$12/mo',
            installed: true, // Pre-installed for demo
            capabilities: ['integration:jira']
        }
    ];

    private listeners: Set<() => void> = new Set();

    getProducts() {
        return this.products;
    }

    installProduct(id: string) {
        const prod = this.products.find(p => p.id === id);
        if (prod) {
            prod.installed = true;
            this.notify();
        }
    }

    uninstallProduct(id: string) {
        const prod = this.products.find(p => p.id === id);
        if (prod) {
            prod.installed = false;
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
