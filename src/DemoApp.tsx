import React, { useEffect, useState, useRef } from 'react';
import { useYjs } from './yjs/YjsProvider';
import { UserContext } from './security/UserContext';
import { MetadataStore } from './metadata/MetadataStore';
import { WorkspaceLayout } from './components/layout/WorkspaceLayout';
import { SideNav } from './components/layout/SideNav';
import { TopBar } from './components/AppHeader'; // Refactored Header
import { ProseMirrorEditor } from './prosemirror/ProseMirrorEditor';
import { SlideRenderer } from './components/slides/SlideRenderer';
import { GovernanceDashboard } from './components/governance/GovernanceDashboard';
import { MarketplaceSidebar } from './components/MarketplaceSidebar';
import { MetadataPanel } from './components/metadata/MetadataPanel';
import { HelpModal } from './components/HelpModal';
import { GlobalReferenceStore } from './stores/GlobalReferenceStore';
import './DemoApp.css';

// Initialize Global Stores
const metadataStore = new MetadataStore();
const globalRefStore = new GlobalReferenceStore();

export const DemoApp: React.FC = () => {
    const { doc: yDoc, connected, provider } = useYjs();
    const [user, setUser] = useState<{ id: string, name: string, role: 'editor' | 'auditor' | 'viewer', color: string } | null>({
        id: 'local-user',
        name: 'Local User',
        role: 'editor',
        color: '#3b82f6'
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

    return (
        <UserContext.Provider value={{ user, setUser }}>
            <div className="demo-app">
                <WorkspaceLayout
                    sideNav={<SideNav currentView={appMode} onNavigate={setAppMode} currentRole={user?.role || 'editor'} onJoinRole={() => { }} />}
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
                            <MarketplaceSidebar />
                        ) : (showMetadataPanel && metadataStore) ? (
                            <MetadataPanel store={metadataStore} onClose={() => setShowMetadataPanel(false)} />
                        ) : null
                    }
                    modals={
                        <>
                            {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
                        </>
                    }
                    yDoc={yDoc}
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
                                currentUser={user}
                            />
                        </div>
                    )}
                </WorkspaceLayout>
            </div>
        </UserContext.Provider>
    );
};
