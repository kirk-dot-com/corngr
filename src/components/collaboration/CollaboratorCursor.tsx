import React, { useEffect, useState } from 'react';
import { EditorView } from 'prosemirror-view';
import './CollaboratorCursor.css';

interface CursorPosition {
    clientId: number;
    user: {
        name: string;
        color: string;
    };
    anchor: number;
    head: number;
}

interface CollaboratorCursorProps {
    editorView: EditorView | null;
    awareness: any; // Yjs Awareness
    localClientId: number;
}

/**
 * CollaboratorCursor - Renders remote user cursors in ProseMirror editor
 * 
 * Phase 6: Real-Time Collaboration
 * Shows where other users are editing with name labels and colored cursors
 */
export const CollaboratorCursor: React.FC<CollaboratorCursorProps> = ({
    editorView,
    awareness,
    localClientId
}) => {
    const [cursors, setCursors] = useState<CursorPosition[]>([]);

    useEffect(() => {
        if (!editorView || !awareness) return;

        const updateCursors = () => {
            const states = awareness.getStates();
            const remoteCursors: CursorPosition[] = [];

            states.forEach((state: any, clientId: number) => {
                // Skip local user
                if (clientId === localClientId) return;

                // Only show cursor if we have both user info and cursor position
                if (state.user && state.cursor) {
                    remoteCursors.push({
                        clientId,
                        user: state.user,
                        anchor: state.cursor.anchor,
                        head: state.cursor.head
                    });
                }
            });

            setCursors(remoteCursors);
        };

        // Update on awareness changes
        awareness.on('change', updateCursors);
        updateCursors(); // Initial update

        return () => {
            awareness.off('change', updateCursors);
        };
    }, [editorView, awareness, localClientId]);

    if (!editorView) return null;


    return (
        <>
            {cursors.map(cursor => {
                try {
                    // Get DOM coordinates for cursor position
                    const coords = editorView.coordsAtPos(cursor.head);
                    const editorRect = editorView.dom.getBoundingClientRect();

                    // Calculate position relative to editor
                    const top = coords.top - editorRect.top;
                    const left = coords.left - editorRect.left;

                    // Don't render if position is invalid
                    if (top < 0 || left < 0) return null;

                    return (
                        <div
                            key={cursor.clientId}
                            className="collaborator-cursor"
                            style={{
                                top: `${top}px`,
                                left: `${left}px`,
                                borderColor: cursor.user.color
                            }}
                        >
                            <div
                                className="collaborator-cursor-label"
                                style={{ backgroundColor: cursor.user.color }}
                            >
                                {cursor.user.name}
                            </div>
                        </div>
                    );
                } catch (e) {
                    // Position might be invalid if document structure changed
                    console.warn('Failed to render cursor:', e);
                    return null;
                }
            })}
        </>
    );
};
