import React, { useEffect, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { InputModal } from './InputModal';
import './DocumentList.css';

interface Document {
    id: string;
    title: string;
    updated_at: string;
    content?: string;
}

interface DocumentListProps {
    supabase: SupabaseClient;
    user: any;
    onSelectDocument: (docId: string) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({ supabase, user, onSelectDocument }) => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [showInputModal, setShowInputModal] = useState(false);

    useEffect(() => {
        fetchDocuments();
    }, [user]);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('documents')
                .select('id, title, updated_at')
                .eq('owner_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setDocuments(data || []);
        } catch (err: any) {
            if (err.message?.includes('title')) {
                console.warn('Title column missing, using defaults');
                setDocuments((prev: any[]) => prev.map((d: any) => ({ ...d, title: 'Untitled Document' })));
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateConfirm = async (title: string) => {
        const effectiveTitle = title.trim() || 'Untitled Document';
        const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2) + Date.now().toString(36);

        const newDocId = `doc_${uuid}`;
        setShowInputModal(false);

        try {
            const { error } = await supabase.from('documents').insert({
                id: newDocId,
                owner_id: user.id,
                title: effectiveTitle,
                content: 'AAA=',
                updated_at: new Date().toISOString()
            });

            if (error) throw error;
            onSelectDocument(newDocId);
        } catch (err: any) {
            console.error('❌ Failed to create document:', err);
            alert('Failed to create: ' + err.message);
        }
    };

    const startRenaming = (doc: Document, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(doc.id);
        setEditTitle(doc.title || 'Untitled Document');
    };

    const saveTitle = async (id: string, e?: React.FormEvent) => {
        if (e) e.stopPropagation();
        try {
            const { error } = await supabase
                .from('documents')
                .update({ title: editTitle })
                .eq('id', id);

            if (error) throw error;

            setDocuments((docs: Document[]) => docs.map((d: Document) => d.id === id ? { ...d, title: editTitle } : d));
            setEditingId(null);
        } catch (err: any) {
            alert('Failed to rename: ' + err.message);
        }
    };

    const deleteDocument = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this document?')) return;

        try {
            const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchDocuments();
        } catch (err: any) {
            alert('Failed to delete document: ' + err.message);
        }
    };

    if (loading) return (
        <div className="dashboard-container">
            <div className="loading-box">
                <div className="spinner"></div>
                <p>Establishing encrypted connection...</p>
            </div>
        </div>
    );

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div className="dashboard-title">
                    <h1>My Documents</h1>
                    <p>Secure collaborative workspace</p>
                </div>
                <div className="header-actions">
                    <button
                        onClick={() => setShowInputModal(true)}
                        className="view-btn primary"
                        style={{ background: '#38a169', border: 'none', color: 'white' }}
                    >
                        ➕ New Document
                    </button>
                    <button
                        onClick={() => supabase.auth.signOut()}
                        className="view-btn warning"
                    >
                        Exit
                    </button>
                </div>
            </div>

            {error && <div className="error-badge">Error: {error}</div>}

            {documents.length === 0 ? (
                <div className="empty-state">
                    <p>Your secure vault is empty.</p>
                    <button onClick={() => setShowInputModal(true)} className="create-first-btn">
                        Create your first document
                    </button>
                </div>
            ) : (
                <div className="doc-grid">
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            onClick={() => onSelectDocument(doc.id)}
                            className="doc-card"
                        >
                            <div className="doc-info">
                                {editingId === doc.id ? (
                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                        <input
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            className="rename-input"
                                            autoFocus
                                            onKeyDown={e => e.key === 'Enter' && saveTitle(doc.id)}
                                        />
                                        <button onClick={(e) => saveTitle(doc.id, e as any)} className="action-icon" style={{ color: '#4cd964' }}>✓</button>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="action-icon">✕</button>
                                    </div>
                                ) : (
                                    <h3>
                                        {doc.title || 'Untitled Document'}
                                        <button
                                            onClick={(e) => startRenaming(doc, e)}
                                            className="action-icon"
                                            title="Rename"
                                            style={{ fontSize: '0.8rem', opacity: 0.5 }}
                                        >
                                            ✎
                                        </button>
                                    </h3>
                                )}
                                <div className="date"> modified {new Date(doc.updated_at).toLocaleDateString()} at {new Date(doc.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                            <div className="doc-actions">
                                <button
                                    onClick={(e) => deleteDocument(doc.id, e)}
                                    className="action-icon delete"
                                    title="Delete Document"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <InputModal
                isOpen={showInputModal}
                title="Create New Document"
                placeholder="Untitled Document"
                confirmLabel="Create"
                onCancel={() => setShowInputModal(false)}
                onConfirm={handleCreateConfirm}
            />
        </div>
    );
};
