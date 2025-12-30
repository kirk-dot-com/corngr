import React from 'react';
import { Toolbar } from '../../prosemirror/Toolbar';
import { ProseMirrorEditor } from '../../prosemirror/ProseMirrorEditor';
import { EditorView } from 'prosemirror-view';
import * as Y from 'yjs';
import { User } from '../../security/types';
import { MetadataStore } from '../../metadata/MetadataStore';
import { Awareness } from 'y-protocols/awareness';

interface EditorPanelProps {
    yDoc: Y.Doc;
    user: User;
    metadataStore: MetadataStore | null;
    awareness: Awareness | null;
    editorView: EditorView | null;
    appMode: 'draft' | 'audit' | 'presentation';
    onBlockSelect: (blockId: string | null) => void;
    editorContainerRef: React.RefObject<HTMLDivElement>;
}

/**
 * EditorPanel - Container for ProseMirror editor with toolbar
 * 
 * Phase 5: Polish - Extracted from DemoApp for better component organization
 */
export const EditorPanel: React.FC<EditorPanelProps> = ({
    yDoc,
    user,
    metadataStore,
    awareness,
    editorView,
    appMode,
    onBlockSelect,
    editorContainerRef
}) => {
    return (
        <div className="editor-panel">
            <div className="panel-header">
                <h2>Document View</h2>
                <span className="tech-badge">ProseMirror</span>
            </div>
            <Toolbar editorView={editorView} yDoc={yDoc} />
            <div ref={editorContainerRef}>
                <ProseMirrorEditor
                    yDoc={yDoc}
                    user={user}
                    metadataStore={metadataStore}
                    awareness={awareness}
                    onBlockSelect={onBlockSelect}
                    editorId="main-editor"
                    appMode={appMode}
                />
            </div>
        </div>
    );
};
