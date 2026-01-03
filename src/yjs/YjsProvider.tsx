import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Y from 'yjs';
import { TauriWebSocketProvider } from '../providers/TauriWebSocketProvider';

interface UserPresence {
    id: string;
    name: string;
    color: string;
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

export const YjsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [doc] = useState(() => new Y.Doc());
    const [provider, setProvider] = useState<TauriWebSocketProvider | null>(null);
    const [connected, setConnected] = useState(false);
    const [users, setUsers] = useState<UserPresence[]>([]);

    useEffect(() => {
        const wsProvider = new TauriWebSocketProvider('doc_default', doc);
        setProvider(wsProvider);

        const checkConnection = setInterval(() => {
            setConnected(wsProvider.connected);
        }, 1000);

        // Awareness updates
        const awareness = wsProvider.awareness;
        const updateAwareness = () => {
            const states = awareness.getStates();
            const activeUsers: UserPresence[] = [];
            states.forEach((state: any, clientId: number) => {
                if (state.user) {
                    activeUsers.push({
                        id: state.user.id || clientId.toString(),
                        name: state.user.name || 'Anonymous',
                        color: state.user.color || '#333',
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
    }, [doc]);

    return (
        <YjsContext.Provider value={{ doc, provider, connected, users }}>
            {children}
        </YjsContext.Provider>
    );
};

export const useYjs = () => useContext(YjsContext);
