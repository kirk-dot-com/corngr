import React from 'react';

type ViewMode = 'split' | 'editor' | 'slides' | 'governance';

interface ViewControlsProps {
    currentView: ViewMode;
    onViewChange: (view: ViewMode) => void;
}

/**
 * ViewControls - View mode selector buttons
 * 
 * Phase 5: Polish - Extracted from DemoApp for better component organization
 */
export const ViewControls: React.FC<ViewControlsProps> = ({ currentView, onViewChange }) => {
    return (
        <div className="mode-selector">
            <span className="mode-label">VIEW:</span>
            <button
                className={`view-btn ${currentView === 'split' ? 'active' : ''}`}
                onClick={() => onViewChange('split')}
            >
                ⚡ Dual
            </button>
            <button
                className={`view-btn ${currentView === 'editor' ? 'active' : ''}`}
                onClick={() => onViewChange('editor')}
            >
                📝 Doc
            </button>
            <button
                className={`view-btn ${currentView === 'slides' ? 'active' : ''}`}
                onClick={() => onViewChange('slides')}
            >
                📊 Slides
            </button>
            <button
                className={`view-btn ${currentView === 'governance' ? 'active' : ''}`}
                onClick={() => onViewChange('governance')}
            >
                🛡️ Gov
            </button>
        </div>
    );
};
