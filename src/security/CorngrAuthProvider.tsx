import React, { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { UserContext } from './UserContext';
import { User } from './types';

// Map OIDC user to Corngr User
const mapOidcUser = (auth: any): User | null => {
    if (!auth.user) return null;

    const profile = auth.user.profile;
    // Extract role from custom claim or fallback
    const role = (profile['https://corngr.com/role'] as any) || 'viewer';

    return {
        id: profile.sub || 'unknown',
        name: profile.name || profile.email || 'Anonymous',
        role,
        color: '#3b82f6', // Generate based on hash in real app
        attributes: {
            role,
            email: profile.email
        }
    };
};

export const CorngrAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const auth = useAuth();
    const [user, setUser] = useState<User | null>(null);

    // Sync auth state to User state
    useEffect(() => {
        if (auth.isLoading) return;

        if (auth.isAuthenticated) {
            setUser(mapOidcUser(auth));
        } else {
            // Check for existing session or auto-login?
            // For now, if not authenticated, user is null (Guest/Public logic or Redirect)
            setUser(null);
        }
    }, [auth.isLoading, auth.isAuthenticated, auth.user]);

    // Enhanced setUser (e.g. for testing role switching)
    // In production OIDC, you can't "set" user locally without re-authing, 
    // but for dev/demo we might want to keep the "Role Switcher" functional if possible,
    // or arguably we should DISABLE it to enforcing "Real Identity".
    // 
    // Plan: If we are in "Dev Mode" (determined by no real OIDC config?), allow manual override.
    // Ideally: We treat OIDC as the source of truth. The manual role switcher in UI should probably define a "Masquerade" mode or just be disabled in Prod.
    // For Phase 1 Pilot, we'll allow manual override ONLY if not authenticated (Guest) or explicit action.

    // Actually, let's keep the `setUser` strictly local for now to maintain existing behavior 
    // until we have a real IdP to switch users with.

    return (
        <UserContext.Provider value={{ user, setUser }}>
            {auth.isLoading ? <div>Loading Auth...</div> : children}
        </UserContext.Provider>
    );
};
