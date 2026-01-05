import React, { useState, useEffect } from 'react';
import { marketplaceStore, MarketplaceProduct } from '../stores/MarketplaceStore';
import './HelpPanel.css'; // Use shared panel styles

interface MarketplaceSidebarProps {
    onClose: () => void;
}

export const MarketplaceSidebar: React.FC<MarketplaceSidebarProps> = ({ onClose }) => {
    const [search, setSearch] = useState('');
    // Initial state from store
    const [products, setProducts] = useState<MarketplaceProduct[]>(marketplaceStore.getProducts());

    useEffect(() => {
        // Initial load
        marketplaceStore.init();

        // Subscribe to store updates
        const unsubscribe = marketplaceStore.subscribe(() => {
            setProducts([...marketplaceStore.getProducts()]); // Force refresh
        });
        return () => { unsubscribe(); };
    }, []);

    const handleToggleInstall = (product: MarketplaceProduct) => {
        if (product.installed) {
            marketplaceStore.uninstallProduct(product.id);
        } else {
            marketplaceStore.installProduct(product.id);
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="help-panel-overlay">
            <div className="help-panel-container">
                <div className="help-panel-header">
                    <div className="help-panel-title">
                        <span className="help-icon">🛍️</span>
                        <h2>Extensions Store</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="help-close-button"
                        aria-label="Close marketplace"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="help-panel-content">
                    <div className="marketplace-search">
                        <input
                            type="text"
                            placeholder="Find capabilities (e.g. Medical, Legal)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="category-tabs">
                        <button className="category-tab active">Featured</button>
                        <button className="category-tab">Enterprise</button>
                        <button className="category-tab">AI Agents</button>
                    </div>

                    <div className="blocks-list">
                        {filteredProducts.map(product => (
                            <div key={product.id} className={`marketplace-card ${product.installed ? 'installed' : ''}`} onClick={() => handleToggleInstall(product)}>
                                <div className="card-icon">{product.icon}</div>
                                <div className="card-info">
                                    <div className="card-title-row">
                                        <h3>{product.name}</h3>
                                        {product.installed && <span className="badge verified">Installed</span>}
                                    </div>
                                    <p className="card-description">{product.description}</p>
                                    <div className="card-footer">
                                        <span className="card-price">{product.price}</span>
                                        {product.capabilities.map(cap => (
                                            <span key={cap} className="cap-tag">{cap.split(':')[1]}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="card-action">
                                    <button
                                        className={`import-btn ${product.installed ? 'secondary' : 'primary'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleInstall(product);
                                        }}
                                    >
                                        {product.installed ? 'Remove' : 'Install'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="help-footer-text">
                        Enterprise Verified Capabilities 🛡️
                    </div>
                </div>
            </div>
        </div>
    );
};
