import React from 'react';
import './WorkspaceLayout.css';

interface WorkspaceLayoutProps {
    sideNav: React.ReactNode;
    topBar: React.ReactNode;
    rightPanel?: React.ReactNode;
    children: React.ReactNode;
    modals?: React.ReactNode;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
    sideNav,
    topBar,
    rightPanel,
    children,
    modals
}) => {
    return (
        <div className="workspace-layout">
            {/* Fixed Left Sidebar */}
            {sideNav}

            {/* Main Area */}
            <div className="workspace-area">
                <div className="top-bar-container">
                    {topBar}
                </div>
                <div className="content-area">
                    {children}
                </div>
            </div>

            {/* Collapsible Right Panel */}
            <div className={`utility-panel ${!rightPanel ? 'collapsed' : ''}`}>
                {rightPanel}
            </div>

            {/* Modals / Overlays */}
            {modals}
        </div>
    );
};
