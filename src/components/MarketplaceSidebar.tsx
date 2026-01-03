import React, { useState, useEffect } from 'react';
import { marketplaceStore, MarketplaceProduct } from '../stores/MarketplaceStore';
import './MarketplaceSidebar.css';

interface MarketplaceSidebarProps {
    onClose: () => void;
    // Removed onImportBlock as it's no longer used directly
}

export const MarketplaceSidebar: React.FC<MarketplaceSidebarProps> = ({ onClose }) => {
    const [search, setSearch] = useState('');
    // Initial state from store
    const [products, setProducts] = useState<MarketplaceProduct[]>(marketplaceStore.getProducts());

    useEffect(() => {
        // Subscribe to store updates
        const unsubscribe = marketplaceStore.subscribe(() => {
            setProducts([...marketplaceStore.getProducts()]); // Force refresh
        });
        return unsubscribe;
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
        <div className="marketplace-sidebar">
            <div className="marketplace-header">
                <h2>Extensions Store</h2>
                <button className="close-btn" onClick={onClose}>&times;</button>
            </div>

            <div className="marketplace-search">
                <input
                    type="text"
                    placeholder="Find capabilities (e.g. Medical, Legal)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="marketplace-content">
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
            </div>

            <div className="marketplace-footer">
                <p>Enterprise Verified Capabilities 🛡️</p>
            </div>

            <style>{`
                .marketplace-sidebar {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    background: #fff;
                }
                .marketplace-header {
                    padding: 16px;
                    border-bottom: 1px solid #eee;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .marketplace-header h2 { margin: 0; font-size: 1.1rem; }
                .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
                .marketplace-search { padding: 12px; border-bottom: 1px solid #f7f7f7; }
                .marketplace-search input { width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; }
                .marketplace-content { flex: 1; overflow-y: auto; padding: 12px; }
                .category-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
                .category-tab {
                    padding: 6px 12px;
                    border-radius: 16px;
                    border: 1px solid #e2e8f0;
                    background: transparent;
                    font-size: 0.8rem;
                    cursor: pointer;
                }
                .category-tab.active { background: #3182ce; color: white; border-color: #3182ce; }
                .blocks-list { display: flex; flex-direction: column; gap: 12px; }
                
                .marketplace-card {
                    display: flex;
                    gap: 12px;
                    padding: 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    align-items: start;
                }
                .marketplace-card:hover { box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
                .marketplace-card.installed { border-color: #48bb78; background: #f0fff4; }
                
                .card-icon { font-size: 2rem; }
                .card-info { flex: 1; }
                .card-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
                .card-title-row h3 { margin: 0; font-size: 0.95rem; font-weight: 600; }
                .badge { font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: bold; background: #e2e8f0; color: #4a5568; }
                .badge.verified { background: #c6f6d5; color: #22543d; }
                .card-description { margin: 0 0 8px 0; font-size: 0.8rem; color: #718096; line-height: 1.4; }
                .card-footer { display: flex; gap: 8px; align-items: center; flex-wrap: wrap;}
                .card-price { font-weight: 600; font-size: 0.8rem; color: #2d3748; }
                
                .cap-tag { font-size: 0.7rem; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; color: #666; border: 1px solid rgba(0,0,0,0.05); }
                
                .card-action { display: flex; align-items: center; }
                .import-btn {
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                }
                .import-btn.primary { background: #3182ce; color: white; }
                .import-btn.secondary { background: white; border: 1px solid #cbd5e0; color: #4a5568; }
                .import-btn.secondary:hover { background: #f7fafc; }
                
                .marketplace-footer { padding: 12px; text-align: center; border-top: 1px solid #eee; font-size: 0.75rem; color: #a0aec0; }
            `}</style>
        </div>
    );
};
