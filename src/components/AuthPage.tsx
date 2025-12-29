import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { SupabaseClient } from '@supabase/supabase-js';

interface AuthPageProps {
    supabase: SupabaseClient;
}

export const AuthPage: React.FC<AuthPageProps> = ({ supabase }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#1a202c',
            color: 'white'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                padding: '2rem',
                background: '#2d3748',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    <h1 style={{ margin: 0, fontSize: '2rem' }}>🌽 Corngr</h1>
                    <p style={{ color: '#a0aec0', marginTop: '0.5rem' }}>Secure Collaborative Editor</p>
                </div>

                <Auth
                    supabaseClient={supabase}
                    appearance={{
                        theme: ThemeSupa,
                        variables: {
                            default: {
                                colors: {
                                    brand: '#667eea',
                                    brandAccent: '#5a67d8',
                                    inputText: 'white',
                                    inputBackground: '#4a5568',
                                    inputLabelText: '#a0aec0',
                                }
                            }
                        }
                    }}
                    providers={[]} // Email only for now
                    theme="dark"
                />
            </div>
        </div>
    );
};
