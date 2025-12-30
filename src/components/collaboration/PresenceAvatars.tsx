import React, { useEffect, useState } from 'react';
import './PresenceAvatars.css';

interface Collaborator {
    clientId: number;
    name: string;
    color: string;
    typing?: boolean;
    lastSeen?: Date;
}

interface PresenceAvatarsProps {
    awareness: any; // Yjs Awareness
    localClientId: number;
}

/**
 * PresenceAvatars - Shows active collaborators in the header
 * 
 * Phase 6: Real-Time Collaboration
 * Displays avatar circles with user initials and activity status
 */
export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({
    awareness,
    localClientId
}) => {
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [showFullList, setShowFullList] = useState(false);

    useEffect(() => {
        if (!awareness) return;

        const updateCollaborators = () => {
            const states = awareness.getStates();
            const remoteUsers: Collaborator[] = [];

            states.forEach((state: any, clientId: number) => {
                // Skip local user
                if (clientId === localClientId) return;

                if (state.user) {
                    remoteUsers.push({
                        clientId,
                        name: state.user.name || 'Anonymous',
                        color: state.user.color || '#667eea',
                        typing: state.typing || false,
                        lastSeen: state.lastSeen ? new Date(state.lastSeen) : new Date()
                    });
                }
            });

            setCollaborators(remoteUsers);
        };

        awareness.on('change', updateCollaborators);
        updateCollaborators();

        return () => {
            awareness.off('change', updateCollaborators);
        };
    }, [awareness, localClientId]);

    if (collaborators.length === 0) return null;

    const getInitials = (name: string): string => {
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const visibleCount = 5;
    const visibleCollaborators = collaborators.slice(0, visibleCount);
    const hiddenCount = Math.max(0, collaborators.length - visibleCount);

    return (
        <div
            className="presence-avatars"
            onMouseEnter={() => setShowFullList(true)}
            onMouseLeave={() => setShowFullList(false)}
        >
            <div className="avatars-row">
                {visibleCollaborators.map(collab => (
                    <div
                        key={collab.clientId}
                        className={`avatar ${collab.typing ? 'typing' : ''}`}
                        style={{ backgroundColor: collab.color }}
                        title={collab.name}
                    >
                        {getInitials(collab.name)}
                    </div>
                ))}
                {hiddenCount > 0 && (
                    <div className="avatar overflow" title={`+${hiddenCount} more`}>
                        +{hiddenCount}
                    </div>
                )}
            </div>

            {showFullList && collaborators.length > 0 && (
                <div className="collaborators-list">
                    <div className="list-header">Active Collaborators</div>
                    {collaborators.map(collab => (
                        <div key={collab.clientId} className="collaborator-item">
                            <div
                                className="avatar-small"
                                style={{ backgroundColor: collab.color }}
                            >
                                {getInitials(collab.name)}
                            </div>
                            <span className="collaborator-name">{collab.name}</span>
                            {collab.typing && (
                                <span className="status-badge typing">typing...</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
