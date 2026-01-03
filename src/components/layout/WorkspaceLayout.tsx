import React, { ReactNode } from 'react';
import './WorkspaceLayout.css';
import { SidecarPanel } from './SidecarPanel';
import { sidecarStore } from '../../stores/SidecarStore'; // Corrected Path
import * as Y from 'yjs';

interface WorkspaceLayoutProps {
    sideNav: ReactNode;
    topBar: ReactNode;
    children: ReactNode;
    rightPanel?: ReactNode; // Optional utility panel (metadata/marketplace)
    modals?: ReactNode;
    yDoc?: Y.Doc; // Add yDoc to props
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
    sideNav,
    topBar,
    children,
    rightPanel,
    modals,
    yDoc
}) => {
    return (
        <div className="workspace-container">
            {/* Fixed Left Navigation */}
            <div className="workspace-sidenav">
                {sideNav}
            </div>

            {/* Main Content Area */}
            <div className="workspace-main">
                {/* Fixed Top Bar */}
                <div className="workspace-topbar">
                    {topBar}
                </div>

                {/* Scrollable Canvas */}
                <div className="workspace-canvas">
                    {children}
                </div>
            </div>

            {/* Right Utility Panel (Collapsible) - Existing */}
            {rightPanel && (
                <div className="workspace-right-panel">
                    {rightPanel}
                </div>
            )}

            {/* AI Sidecar (Overlay or Collapsible) */}
            {yDoc && <SidecarPanel yDoc={yDoc} />}

            {/* Absolute Modals */}
            {modals}
        </div>
    );
};
