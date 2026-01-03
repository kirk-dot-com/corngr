import React, { useEffect, useState } from 'react';
import { EditorView } from 'prosemirror-view';
import './CollaboratorCursor.css';

interface CursorPosition {
    clientId: number;
    user: {
        name: string;
        color: string;
        email?: string;
    };
    anchor: number;
    head: number;
    isTyping?: boolean;
    lastActivity?: number;
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
 * Shows where other users are editing with name labels, colored cursors, and selection highlights
 */
export const CollaboratorCursor: React.FC<CollaboratorCursorProps> = ({
    editorView,
    awareness,
    localClientId
}) => {
    const [cursors, setCursors] = useState<CursorPosition[]>([]);
    const [idleCursors, setIdleCursors] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (!editorView || !awareness) return;

        const updateCursors = () => {
            const states = awareness.getStates();
            const remoteCursors: CursorPosition[] = [];
            const now = Date.now();

            states.forEach((state: any, clientId: number) => {
                // Skip local user
                if (clientId === localClientId) return;

                // Only show cursor if we have both user info and cursor position
                if (state.user && state.cursor) {
                    const lastActivity = state.cursor.lastActivity || now;
                    const isTyping = state.cursor.isTyping || false;

                    remoteCursors.push({
                        clientId,
                        user: state.user,
                        anchor: state.cursor.anchor,
                        head: state.cursor.head,
                        isTyping,
                        lastActivity
                    });
                }
            });

            setCursors(remoteCursors);
        };

        // Update on awareness changes
        awareness.on('change', updateCursors);
        updateCursors(); // Initial update

        // Check for idle cursors every second
        const idleCheckInterval = setInterval(() => {
            const now = Date.now();
            const idle = new Set<number>();

            cursors.forEach(cursor => {
                if (cursor.lastActivity && now - cursor.lastActivity > 3000) {
                    idle.add(cursor.clientId);
                }
            });

            setIdleCursors(idle);
        }, 1000);

        return () => {
            awareness.off('change', updateCursors);
            clearInterval(idleCheckInterval);
        };
    }, [editorView, awareness, localClientId]);

    if (!editorView) return null;

    return (
        <>
            {cursors.map(cursor => {
                try {
                    const isIdle = idleCursors.has(cursor.clientId);

                    // Get DOM coordinates for cursor position
                    const headCoords = editorView.coordsAtPos(cursor.head);
                    const editorRect = editorView.dom.getBoundingClientRect();

                    // Calculate position relative to editor
                    const top = headCoords.top - editorRect.top;
                    const left = headCoords.left - editorRect.left;

                    // Don't render if position is invalid
                    if (top < 0 || left < 0) return null;

                    // Render selection highlight if there is a selection
                    let selectionElement = null;
                    if (cursor.anchor !== cursor.head) {
                        try {
                            const anchorCoords = editorView.coordsAtPos(cursor.anchor);
                            const selectionTop = Math.min(headCoords.top, anchorCoords.top) - editorRect.top;
                            const selectionLeft = Math.min(headCoords.left, anchorCoords.left) - editorRect.left;
                            const selectionWidth = Math.abs(headCoords.left - anchorCoords.left);
                            const selectionHeight = Math.abs(headCoords.top - anchorCoords.top) || 20;

                            selectionElement = (
                                <div
                                    className="collaborator-selection"
                                    style={{
                                        top: `${selectionTop}px`,
                                        left: `${selectionLeft}px`,
                                        width: `${selectionWidth}px`,
                                        height: `${selectionHeight}px`,
                                        backgroundColor: `${cursor.user.color}33` // 20% opacity
                                    }}
                                />
                            );
                        } catch (e) {
                            // Selection coordinates might be invalid
                        }
                    }

                    return (
                        <React.Fragment key={cursor.clientId}>
                            {selectionElement}
                            <div
                                className={`collaborator-cursor ${isIdle ? 'cursor-idle' : ''}`}
                                style={{
                                    top: `${top}px`,
                                    left: `${left}px`,
                                    borderColor: cursor.user.color
                                }}
                            >
                                <div
                                    className="collaborator-cursor-label"
                                    style={{ backgroundColor: cursor.user.color }}
                                    title={cursor.user.email || cursor.user.name}
                                >
                                    {cursor.user.name}
                                    {cursor.isTyping && (
                                        <span className="typing-indicator">
                                            <span className="typing-dot"></span>
                                            <span className="typing-dot"></span>
                                            <span className="typing-dot"></span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </React.Fragment>
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
