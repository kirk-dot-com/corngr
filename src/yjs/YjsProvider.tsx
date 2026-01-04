import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Y from 'yjs';
import { TauriWebSocketProvider } from '../providers/TauriWebSocketProvider';

interface UserPresence {
    id: string;
    name: string;
    color: string;
    role: string;
    cursor?: { anchor: number, head: number } | null;
}

interface YjsContextType {
    doc: Y.Doc;
    provider: TauriWebSocketProvider | null;
    connected: boolean;
    users: UserPresence[];
}

const YjsContext = createContext<YjsContextType>({
    doc: new Y.Doc(),
    provider: null,
    connected: false,
    users: []
});

export const YjsProvider: React.FC<{
    children: React.ReactNode;
    docId?: string;
    user?: { id: string; name: string; color: string; role: string } | null;
}> = ({ children, docId = 'doc_default', user }) => {
    const [doc] = useState(() => new Y.Doc());
    const [provider, setProvider] = useState<TauriWebSocketProvider | null>(null);
    const [connected, setConnected] = useState(false);
    const [users, setUsers] = useState<UserPresence[]>([]);

    useEffect(() => {
        // cleanup previous provider if it exists
        if (provider) {
            provider.destroy();
        }

        const wsProvider = new TauriWebSocketProvider(docId, doc, user);
        setProvider(wsProvider);

        const checkConnection = setInterval(() => {
            setConnected(wsProvider.connected);
        }, 1000);

        // Awareness updates
        const awareness = wsProvider.awareness;

        // Set local user state
        if (user) {
            awareness.setLocalStateField('user', {
                id: user.id,
                name: user.name,
                color: user.color,
                role: user.role
            });
        }

        const updateAwareness = () => {
            const states = awareness.getStates();
            const activeUsers: UserPresence[] = [];
            states.forEach((state: any, clientId: number) => {
                if (state.user) {
                    activeUsers.push({
                        id: state.user.id || clientId.toString(),
                        name: state.user.name || 'Anonymous',
                        color: state.user.color || '#333',
                        role: state.user.role || 'viewer',
                        cursor: state.cursor
                    });
                }
            });
            setUsers(activeUsers);
        };

        awareness.on('change', updateAwareness);

        return () => {
            clearInterval(checkConnection);
            awareness.off('change', updateAwareness);
            wsProvider.destroy();
        };
    }, [doc, docId, user?.role, user?.name]); // Re-connect if docId changes or user details change

    return (
        <YjsContext.Provider value={{ doc, provider, connected, users }}>
            {children}
        </YjsContext.Provider>
    );
};

export const useYjs = () => useContext(YjsContext);
