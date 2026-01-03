import React, { createContext, useContext } from 'react';
import { User } from './types';

interface UserContextType {
    user: User | null;
    setUser: (user: User | null) => void;
}

// @ts-ignore
export const UserContext = createContext<UserContextType>({ user: null, setUser: () => { } });

export const useUser = () => useContext(UserContext);
