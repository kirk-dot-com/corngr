import React, { useEffect, useState, useRef } from 'react';

export interface CommandItem {
    id: string;
    label: string;
    icon: string;
    description: string;
    action: (editorView: any) => void;
}

interface SlashCommandMenuProps {
    items: CommandItem[];
    query: string;
    coords: { top: number; left: number };
    selectedIndex: number;
    onSelect: (item: CommandItem) => void;
    onClose: () => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
    items,
    query,
    coords,
    selectedIndex,
    onSelect,
    onClose
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    return (
        <div
            ref={menuRef}
            className="slash-command-menu"
            style={{
                position: 'fixed',
                top: coords.top + 24, // Offset below cursor
                left: coords.left,
                zIndex: 9999,
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                border: '1px solid #e2e8f0',
                width: '300px',
                maxHeight: '300px', // Scrollable
                overflowY: 'auto',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
            }}
        >
            {items.length === 0 ? (
                <div style={{ padding: '8px', color: '#a0aec0', fontSize: '0.85rem' }}>
                    No commands found
                </div>
            ) : (
                items.map((item, index) => (
                    <button
                        key={item.id}
                        onClick={() => onSelect(item)}
                        onMouseEnter={() => { /* optional: set index on hover */ }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            background: index === selectedIndex ? '#ebf8ff' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.1s'
                        }}
                    >
                        <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#2d3748' }}>{item.label}</span>
                            <span style={{ fontSize: '0.75rem', color: '#718096' }}>{item.description}</span>
                        </div>
                    </button>
                ))
            )}
        </div>
    );
};
