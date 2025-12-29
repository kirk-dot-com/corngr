import React, { useState, useEffect, useRef } from 'react';
import './CommandPalette.css';

export interface CommandAction {
    id: string;
    label: string;
    icon: string;
    category: 'Application' | 'Navigation' | 'Governance' | 'Presentation';
    shortcut?: string;
    onExecute: () => void;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    actions: CommandAction[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, actions }) => {
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filtered actions based on query
    const filteredActions = actions.filter(action =>
        action.label.toLowerCase().includes(query.toLowerCase()) ||
        action.category.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setActiveIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % (filteredActions.length || 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + filteredActions.length) % (filteredActions.length || 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredActions[activeIndex]) {
                    filteredActions[activeIndex].onExecute();
                    onClose();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredActions, activeIndex, onClose]);

    if (!isOpen) return null;

    // Grouping by category
    const groupedActions: Record<string, CommandAction[]> = {};
    filteredActions.forEach(action => {
        if (!groupedActions[action.category]) groupedActions[action.category] = [];
        groupedActions[action.category].push(action);
    });

    let globalCounter = 0;

    return (
        <div className="command-palette-overlay" onClick={onClose}>
            <div className="command-palette" onClick={e => e.stopPropagation()}>
                <div className="palette-search-container">
                    <span className="palette-search-icon">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="palette-input"
                        placeholder="Search for commands, modes, or documents..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>

                <div className="palette-list">
                    {filteredActions.length === 0 && (
                        <div className="p-8 text-center opacity-40">No commands found matching "{query}"</div>
                    )}

                    {Object.entries(groupedActions).map(([category, items]) => (
                        <div key={category} className="palette-group">
                            <div className="palette-group-label">{category}</div>
                            {items.map(action => {
                                const currentIndex = globalCounter++;
                                const isActive = currentIndex === activeIndex;

                                return (
                                    <div
                                        key={action.id}
                                        className={`palette-item ${isActive ? 'active' : ''}`}
                                        onMouseEnter={() => setActiveIndex(currentIndex)}
                                        onClick={() => { action.onExecute(); onClose(); }}
                                    >
                                        <div className="item-main">
                                            <span className="item-icon">{action.icon}</span>
                                            <span className="item-label">{action.label}</span>
                                        </div>
                                        {action.shortcut && <span className="item-shortcut">{action.shortcut}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="palette-footer">
                    <div className="footer-key-info">
                        <div className="footer-key"><span className="key-badge">⏎</span> Select</div>
                        <div className="footer-key"><span className="key-badge">↑↓</span> Navigate</div>
                        <div className="footer-key"><span className="key-badge">ESC</span> Close</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
