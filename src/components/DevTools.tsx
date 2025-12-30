import React from 'react';

interface DevToolsProps {
    autoMutate: boolean;
    onToggleAutoMutate: () => void;
    onInsertTransclusion: () => void;
    onInjectMassiveData: () => void;
    onRunStressTest: () => void;
}

/**
 * DevTools - Development utilities toolbar
 * 
 * Contains buttons for testing and debugging:
 * - Insert transclusion references
 * - Inject 1000 test blocks
 * - Toggle auto-mutation
 * - Run performance stress tests
 * 
 * Phase 5: Polish - Extracted from DemoApp for better component organization
 */
export const DevTools: React.FC<DevToolsProps> = ({
    autoMutate,
    onToggleAutoMutate,
    onInsertTransclusion,
    onInjectMassiveData,
    onRunStressTest
}) => {
    return (
        <div className="dev-tools">
            <span className="mode-label">DEV:</span>
            <button
                className="view-btn"
                onClick={onInsertTransclusion}
                title="Insert Transclusion"
            >
                🌐 +Ref
            </button>
            <button
                className="view-btn"
                onClick={onInjectMassiveData}
                title="Inject 1k Blocks"
            >
                🚀 1k
            </button>
            <button
                className={`view-btn ${autoMutate ? 'active' : ''}`}
                onClick={onToggleAutoMutate}
                title="Auto-Mutate Toggle"
            >
                ⚡ Auto
            </button>
            <button
                className="view-btn"
                onClick={onRunStressTest}
                title="Run Stress Test"
            >
                🧪 Test
            </button>
        </div>
    );
};
