import React, { useEffect, useState } from 'react';
import './PresenceNotifications.css';

interface Notification {
    id: string;
    type: 'join' | 'leave' | 'editing';
    userName: string;
    message: string;
    timestamp: number;
}

interface PresenceNotificationsProps {
    awareness: any; // Yjs Awareness
    localClientId: number;
}

/**
 * PresenceNotifications - Toast notifications for user presence events
 * 
 * Phase 6: Presence improvements
 * Shows notifications when users join, leave, or start editing
 */
export const PresenceNotifications: React.FC<PresenceNotificationsProps> = ({
    awareness,
    localClientId
}) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        if (!awareness) return;

        // Track known clients to detect joins/leaves
        const knownClients = new Set<number>();
        const states = awareness.getStates();
        states.forEach((_, clientId) => {
            if (clientId !== localClientId) {
                knownClients.add(clientId);
            }
        });

        const handleAwarenessChange = () => {
            const currentStates = awareness.getStates();
            const currentClients = new Set<number>();

            // Find new users (joins)
            currentStates.forEach((state: any, clientId: number) => {
                if (clientId === localClientId) return;

                currentClients.add(clientId);

                if (!knownClients.has(clientId) && state.user) {
                    addNotification({
                        type: 'join',
                        userName: state.user.name,
                        message: `${state.user.name} joined the document`
                    });
                    knownClients.add(clientId);
                }
            });

            // Find users who left
            knownClients.forEach(clientId => {
                if (!currentClients.has(clientId)) {
                    // User left, but we don't have their name anymore
                    addNotification({
                        type: 'leave',
                        userName: 'User',
                        message: 'A user left the document'
                    });
                    knownClients.delete(clientId);
                }
            });
        };

        awareness.on('change', handleAwarenessChange);

        return () => {
            awareness.off('change', handleAwarenessChange);
        };
    }, [awareness, localClientId]);

    const addNotification = ({ type, userName, message }: Omit<Notification, 'id' | 'timestamp'>) => {
        const notification: Notification = {
            id: `${Date.now()}-${Math.random()}`,
            type,
            userName,
            message,
            timestamp: Date.now()
        };

        setNotifications(prev => [...prev, notification]);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
        }, 4000);
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'join': return '👋';
            case 'leave': return '👋';
            case 'editing': return '✏️';
            default: return '📢';
        }
    };

    const getNotificationClass = (type: string) => {
        switch (type) {
            case 'join': return 'notification-join';
            case 'leave': return 'notification-leave';
            case 'editing': return 'notification-editing';
            default: return '';
        }
    };

    return (
        <div className="presence-notifications">
            {notifications.map((notif, index) => (
                <div
                    key={notif.id}
                    className={`notification ${getNotificationClass(notif.type)}`}
                    style={{
                        bottom: `${20 + index * 70}px`,
                        animation: 'slideIn 0.3s ease-out'
                    }}
                >
                    <div className="notification-icon">
                        {getNotificationIcon(notif.type)}
                    </div>
                    <div className="notification-content">
                        <div className="notification-message">{notif.message}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};
