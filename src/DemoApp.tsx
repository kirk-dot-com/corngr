import React, { useEffect, useState, useContext } from 'react';
import { useYjs, YjsProvider } from './yjs/YjsProvider';
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
import { SecurityDashboard } from './components/security/SecurityDashboard';
import { ToastContainer, useToast } from './components/Toast';
import './DemoApp.css';
import { User } from './security/types';

// Initialize Global Stores
const metadataStore = new MetadataStore();

interface DemoAppContentProps {
    user: User | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;

    onDocChange: (id: string, title?: string) => void;
    docTitle: string;
}

const DemoAppContent: React.FC<DemoAppContentProps> = ({ user, setUser, onDocChange, docTitle }) => {
    const { doc: yDoc, provider } = useYjs();
    const [appMode, setAppMode] = useState<'editor' | 'slides' | 'split' | 'governance'>('split');
    const [showMarketplace, setShowMarketplace] = useState(false);
    const [showMetadataPanel, setShowMetadataPanel] = useState(false);
    const [showSecurity, setShowSecurity] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const { toasts, dismissToast, success } = useToast();

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
                            title={docTitle}
                            onToggleMarketplace={() => setShowMarketplace(!showMarketplace)}
                            onToggleMetadata={() => setShowMetadataPanel(!showMetadataPanel)}
                            onToggleSecurity={() => setShowSecurity(!showSecurity)}
                            onToggleHelp={() => setShowHelp(true)}
                            metadataStore={metadataStore}
                            onDocChange={onDocChange}
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
                            <SecurityDashboard isOpen={showSecurity} onClose={() => setShowSecurity(false)} metadataStore={metadataStore} />
                            <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} />
                            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
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
                                onToast={success}
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
                                    onToast={success}
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

export const DemoApp: React.FC = () => {
    const [docId, setDocId] = useState('doc_default');
    const [docTitle, setDocTitle] = useState('Project Alpha');
    const { user, setUser } = React.useContext(UserContext); // Use OIDC-provided user
    /* 
    // Legacy local state removed in favor of UserContext
    const [user, setUser] = useState<User | null>({
        id: 'local-user', ... 
    });
    */

    const handleDocChange = (id: string, title: string = 'Untitled Doc') => {
        if (id === '_CURRENT_') {
            // Just update the title of the current doc
            setDocTitle(title);
        } else {
            // Switch document
            setDocId(id);
            setDocTitle(title);
        }
    };

    return (
        <YjsProvider docId={docId} user={user}>
            <DemoAppContent
                user={user}
                setUser={setUser}

                onDocChange={handleDocChange}
                docTitle={docTitle}
            />
        </YjsProvider>
    );
};
