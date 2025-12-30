import React from 'react';
import { SlideRenderer } from '../../slides/SlideRenderer';
import * as Y from 'yjs';
import { User } from '../../security/types';

interface SlidesPanelProps {
    yDoc: Y.Doc;
    user: User;
}

/**
 * SlidesPanel - Container for slide renderer view
 * 
 * Phase 5: Polish - Extracted from DemoApp for better component organization
 */
export const SlidesPanel: React.FC<SlidesPanelProps> = ({ yDoc, user }) => {
    return (
        <div className="slides-panel">
            <div className="panel-header">
                <h2>Slide View</h2>
                <span className="tech-badge">React</span>
            </div>
            <SlideRenderer yDoc={yDoc} user={user} />
        </div>
    );
};
