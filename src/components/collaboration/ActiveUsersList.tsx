import React, { useEffect, useState } from 'react';
import './ActiveUsersList.css';

interface ActiveUser {
    clientId: number;
    name: string;
    email?: string;
    color: string;
    status: 'online' | 'idle' | 'away';
    lastActivity: number;
    isFollowing?: boolean;
}

interface ActiveUsersListProps {
    awareness: any; // Yjs Awareness
    localClientId: number;
    onFollowUser?: (clientId: number | null) => void;
}

/**
 * ActiveUsersList - Sidebar showing all connected users
 * 
 * Phase 6: Presence improvements
 * Displays active collaborators with status indicators and "follow user" functionality
 */
export const ActiveUsersList: React.FC<ActiveUsersListProps> = ({
    awareness,
    localClientId,
    onFollowUser
}) => {
    const [users, setUsers] = useState<ActiveUser[]>([]);
    const [followingClientId, setFollowingClientId] = useState<number | null>(null);

    useEffect(() => {
        if (!awareness) return;

        const updateUsers = () => {
            const states = awareness.getStates();
            const activeUsers: ActiveUser[] = [];
            const now = Date.now();

            states.forEach((state: any, clientId: number) => {
                if (!state.user) return;

                const lastActivity = state.cursor?.lastActivity || now;
                const timeSinceActivity = now - lastActivity;

                let status: 'online' | 'idle' | 'away' = 'online';
                if (timeSinceActivity > 300000) status = 'away'; // 5 minutes
                else if (timeSinceActivity > 30000) status = 'idle'; // 30 seconds

                activeUsers.push({
                    clientId,
                    name: state.user.name,
                    email: state.user.email,
                    color: state.user.color,
                    status,
                    lastActivity,
                    isFollowing: clientId === followingClientId
                });
            });

            // Sort: local user first, then by activity
            activeUsers.sort((a, b) => {
                if (a.clientId === localClientId) return -1;
                if (b.clientId === localClientId) return 1;
                return b.lastActivity - a.lastActivity;
            });

            setUsers(activeUsers);
        };

        awareness.on('change', updateUsers);
        updateUsers();

        // Update status every 5 seconds
        const statusInterval = setInterval(updateUsers, 5000);

        return () => {
            awareness.off('change', updateUsers);
            clearInterval(statusInterval);
        };
    }, [awareness, localClientId, followingClientId]);

    const handleFollowUser = (clientId: number) => {
        const newFollowingId = followingClientId === clientId ? null : clientId;
        setFollowingClientId(newFollowingId);
        onFollowUser?.(newFollowingId);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'online': return '🟢';
            case 'idle': return '🟡';
            case 'away': return '⚫';
            default: return '⚪';
        }
    };

    const formatLastActivity = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        return `${Math.floor(seconds / 3600)}h ago`;
    };

    return (
        <div className="active-users-list">
            <div className="users-header">
                <h3>👥 Active Users</h3>
                <span className="user-count">{users.length}</span>
            </div>

            <div className="users-container">
                {users.map(user => (
                    <div
                        key={user.clientId}
                        className={`user-item ${user.clientId === localClientId ? 'user-local' : ''} ${user.isFollowing ? 'user-following' : ''}`}
                    >
                        <div className="user-avatar" style={{ backgroundColor: user.color }}>
                            {user.name.charAt(0).toUpperCase()}
                        </div>

                        <div className="user-info">
                            <div className="user-name">
                                {user.name}
                                {user.clientId === localClientId && (
                                    <span className="user-badge">You</span>
                                )}
                            </div>
                            <div className="user-status">
                                {getStatusIcon(user.status)} {formatLastActivity(user.lastActivity)}
                            </div>
                        </div>

                        {user.clientId !== localClientId && (
                            <button
                                className="follow-btn"
                                onClick={() => handleFollowUser(user.clientId)}
                                title={user.isFollowing ? 'Stop following' : 'Follow user'}
                            >
                                {user.isFollowing ? '👁️' : '👁️‍🗨️'}
                            </button>
                        )}
                    </div>
                ))}

                {users.length === 0 && (
                    <div className="no-users">
                        No active users
                    </div>
                )}
            </div>
        </div>
    );
};
