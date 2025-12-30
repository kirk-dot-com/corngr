import React from 'react';
import './ModeIndicator.css';

interface ModeIndicatorProps {
    mode: 'draft' | 'audit' | 'presentation';
}

/**
 * ModeIndicator - Prominent visual indicator for app mode
 * 
 * Displays the current application mode with distinct styling:
 * - Draft: Green accent, pencil icon
 * - Audit: Orange/amber accent, shield icon  
 * - Presentation: Blue accent, slides icon
 * 
 * Phase 5: Polish - Improves mode switching UX visibility
 */
export const ModeIndicator: React.FC<ModeIndicatorProps> = ({ mode }) => {
    const modeConfig = {
        draft: {
            icon: '📝',
            label: 'DRAFTING',
            tooltip: 'Draft Mode - Edit and create content freely'
        },
        audit: {
            icon: '🛡️',
            label: 'AUDIT MODE',
            tooltip: 'Audit Mode - Review signed blocks and governance'
        },
        presentation: {
            icon: '📊',
            label: 'PRESENTATION',
            tooltip: 'Presentation Mode - View slides and present content'
        }
    };

    const config = modeConfig[mode];

    return (
        <div
            className={`mode-indicator mode-${mode}`}
            title={config.tooltip}
        >
            <span className="mode-icon">{config.icon}</span>
            <span className="mode-label">{config.label}</span>
        </div>
    );
};
