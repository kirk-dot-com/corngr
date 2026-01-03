import React, { useEffect, useState } from 'react';
import { useYjs } from './yjs/YjsProvider';
import { UserContext } from './security/UserContext';
import { MetadataStore } from './metadata/MetadataStore';
import { WorkspaceLayout } from './components/layout/WorkspaceLayout';
import { SideNav } from './components/layout/SideNav';
import { TopBar } from './components/AppHeader';
import { ProseMirrorEditor } from './prosemirror/ProseMirrorEditor';
import { SlideRenderer } from './components/slides/SlideRenderer';
import { GovernanceDashboard } from './components/governance/GovernanceDashboard';
import { MarketplaceSidebar } from './components/MarketplaceSidebar';
import { MetadataPanel } from './components/MetadataPanel';
import { HelpPanel } from './components/HelpPanel';
import './DemoApp.css';
import { User } from './security/types';

// Initialize Global Stores
const metadataStore = new MetadataStore();

export const DemoApp: React.FC = () => {
    const { doc: yDoc, provider } = useYjs();
    const [user, setUser] = useState<User | null>({
        id: 'local-user',
        name: 'Local User',
        role: 'editor',
        color: '#3b82f6',
        attributes: { role: 'editor' }
    });

    const [appMode, setAppMode] = useState<'editor' | 'slides' | 'split' | 'governance'>('split');
    const [showMarketplace, setShowMarketplace] = useState(false);
    const [showMetadataPanel, setShowMetadataPanel] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

    // Initialize MetadataStore with Y.Doc
    useEffect(() => {
        if (yDoc) {
            metadataStore.initialize(yDoc);
        }
    }, [yDoc]);

    // Handle view change from SideNav
    const handleViewChange = (mode: 'editor' | 'slides' | 'split' | 'governance') => {
        setAppMode(mode);
    };

    return (
        <UserContext.Provider value={{ user, setUser }}>
            <div className="demo-app">
                <WorkspaceLayout
                    sideNav={
                        <SideNav
                            currentView={appMode}
                            currentUser={user!}
                            onViewChange={handleViewChange}
                            onRoleChange={() => {
                                // Simple role toggle for demo
                                const newRole = user?.role === 'editor' ? 'auditor' : 'editor';
                                setUser(u => u ? { ...u, role: newRole, attributes: { ...u.attributes, role: newRole } } : null);
                            }}
                        />
                    }
                    topBar={
                        <TopBar
                            title="Project Alpha"
                            onToggleMarketplace={() => setShowMarketplace(!showMarketplace)}
                            onToggleMetadata={() => setShowMetadataPanel(!showMetadataPanel)}
                            onToggleHelp={() => setShowHelp(true)}
                            metadataStore={metadataStore}
                        />
                    }
                    rightPanel={
                        (showMarketplace) ? (
                            <MarketplaceSidebar onClose={() => setShowMarketplace(false)} />
                        ) : (showMetadataPanel && metadataStore) ? (
                            <MetadataPanel
                                selectedBlockId={selectedBlockId}
                                metadataStore={metadataStore}
                                user={user!}
                                onClose={() => setShowMetadataPanel(false)}
                            />
                        ) : null
                    }
                    modals={
                        <>
                            <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} />
                        </>
                    }
                    yDoc={yDoc} // Pass yDoc to Layout for Sidecar
                >
                    {/* VIEW ROUTING */}
                    {appMode === 'editor' && (
                        <div className="view-container">
                            <ProseMirrorEditor
                                yDoc={yDoc}
                                user={user}
                                metadataStore={metadataStore}
                                awareness={provider?.awareness}
                                onBlockSelect={setSelectedBlockId}
                            />
                        </div>
                    )}

                    {appMode === 'slides' && (
                        <div className="view-container">
                            <SlideRenderer yDoc={yDoc} />
                        </div>
                    )}

                    {appMode === 'split' && (
                        <div className="split-view">
                            <div className="split-pane left">
                                <ProseMirrorEditor
                                    yDoc={yDoc}
                                    user={user}
                                    metadataStore={metadataStore}
                                    awareness={provider?.awareness}
                                    onBlockSelect={setSelectedBlockId}
                                />
                            </div>
                            <div className="split-pane right">
                                <SlideRenderer yDoc={yDoc} />
                            </div>
                        </div>
                    )}

                    {appMode === 'governance' && (
                        <div className="view-container">
                            <GovernanceDashboard
                                metadataStore={metadataStore}
                                yDoc={yDoc}
                            />
                        </div>
                    )}
                </WorkspaceLayout>
            </div>
        </UserContext.Provider>
    );
};
