import React, { useState } from 'react';
import './MarketplaceSidebar.css';

export interface MarketplaceBlock {
    id: string;
    title: string;
    description: string;
    author: string;
    type: 'paragraph' | 'heading1' | 'variable' | 'grid' | 'workflow';
    badge: 'Premium' | 'Verified' | 'Free' | 'Core';
    icon: string;
    price: string;
    data: any; // The actual block content template
}

const MOCK_MARKETPLACE_BLOCKS: MarketplaceBlock[] = [
    {
        id: 'm-block-1',
        title: 'Risk Assessment Workflow',
        description: 'Secure, compliant process for evaluating enterprise risks.',
        author: 'AuditCorp',
        type: 'workflow',
        badge: 'Premium',
        icon: '🛡️',
        price: '$99',
        data: {
            text: 'Step 1: Identify Asset\nStep 2: Evaluate Vulnerability\nStep 3: Define Mitigation',
            metadata: { classification: 'restricted', locked: true }
        }
    },
    {
        id: 'm-block-2',
        title: 'Financial Audit Grid',
        description: 'Encrypted data grid for secure reporting and reconciliation.',
        author: 'FinSec',
        type: 'grid',
        badge: 'Verified',
        icon: '📊',
        price: '$149',
        data: {
            text: 'Financial Year 2024 Audit Data Placeholder',
            metadata: { classification: 'confidential', locked: false }
        }
    },
    {
        id: 'm-block-3',
        title: 'Executive Summary',
        description: 'Confidential text block with professional formatting and limited access.',
        author: 'Corngr Foundation',
        type: 'paragraph',
        badge: 'Core',
        icon: '📝',
        price: 'Included',
        data: {
            text: 'High-level objective and summary of strategic alignment.',
            metadata: { classification: 'internal', locked: false }
        }
    },
    {
        id: 'm-block-4',
        title: 'Secure Note',
        description: 'Military-grade end-to-end encrypted notes for shared environments.',
        author: 'PrivacyLabs',
        type: 'paragraph',
        badge: 'Premium',
        icon: '🔐',
        price: '$29',
        data: {
            text: 'ENCRYPTED_PAYLOAD_V1',
            metadata: { classification: 'top_secret', locked: true }
        }
    }
];

interface MarketplaceSidebarProps {
    onImportBlock: (block: MarketplaceBlock) => void;
    onClose: () => void;
}

export const MarketplaceSidebar: React.FC<MarketplaceSidebarProps> = ({ onImportBlock, onClose }) => {
    const [search, setSearch] = useState('');

    const filteredBlocks = MOCK_MARKETPLACE_BLOCKS.filter(b =>
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        b.author.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="marketplace-sidebar">
            <div className="marketplace-header">
                <h2>Block Marketplace</h2>
                <button className="close-btn" onClick={onClose}>&times;</button>
            </div>

            <div className="marketplace-search">
                <input
                    type="text"
                    placeholder="Search blocks, authors..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="marketplace-content">
                <div className="category-tabs">
                    <button className="category-tab active">All</button>
                    <button className="category-tab">Workflows</button>
                    <button className="category-tab">Security</button>
                </div>

                <div className="blocks-list">
                    {filteredBlocks.map(block => (
                        <div key={block.id} className="marketplace-card" onClick={() => onImportBlock(block)}>
                            <div className="card-icon">{block.icon}</div>
                            <div className="card-info">
                                <div className="card-title-row">
                                    <h3>{block.title}</h3>
                                    <span className={`badge ${block.badge.toLowerCase()}`}>{block.badge}</span>
                                </div>
                                <p className="card-description">{block.description}</p>
                                <div className="card-footer">
                                    <span className="card-author">By {block.author}</span>
                                    <span className="card-price">{block.price}</span>
                                </div>
                            </div>
                            <div className="card-action">
                                <button className="import-btn">Deploy</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="marketplace-footer">
                <p>Provenance verified by Corngr Chain ⛓️</p>
            </div>
        </div>
    );
};
