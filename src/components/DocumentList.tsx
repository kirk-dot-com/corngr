import React, { useEffect, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

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
            // Silence 'column does not exist' error during migration phase
            if (err.message?.includes('title')) {
                console.warn('Title column missing, using defaults');
                setDocuments((prev) => prev.map(d => ({ ...d, title: 'Untitled Document' })));
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const createNewDocument = async () => {
        const title = prompt('Enter document name:', 'New Document');
        if (!title) return;

        const newDocId = `doc_${crypto.randomUUID()}`;

        // Optimistic UI updates are hard here without creating the row first,
        // so we'll pass the intention to create/name it via the secure network later,
        // or we just pre-create it here.
        // Let's pre-create to ensure the title is saved.
        // Initialize with a valid empty Yjs state ([0, 0] encoded as Base64 is 'AAA=')
        const { error } = await supabase.from('documents').insert({
            id: newDocId,
            owner_id: user.id,
            title: title,
            content: 'AAA=', // Valid empty Yjs state
            updated_at: new Date().toISOString()
        });

        if (error) {
            alert('Failed to create: ' + error.message);
            return;
        }

        onSelectDocument(newDocId);
    };

    const startRenaming = (doc: Document, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(doc.id);
        setEditTitle(doc.title || 'Untitled Document');
    };

    const saveTitle = async (id: string) => {
        try {
            const { error } = await supabase
                .from('documents')
                .update({ title: editTitle })
                .eq('id', id);

            if (error) throw error;

            setDocuments(docs => docs.map(d => d.id === id ? { ...d, title: editTitle } : d));
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

    if (loading) return <div className="p-8 text-center text-gray-400">Loading documents...</div>;

    return (
        <div className="max-w-4xl mx-auto p-8 text-white">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-2">My Documents</h1>
                    <p className="text-gray-400">Manage your secure collaborative documents.</p>
                </div>
                <button
                    onClick={createNewDocument}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                    <span>+</span> New Document
                </button>
            </div>

            {error && (
                <div className="bg-red-900/50 border border-red-800 p-4 rounded-lg mb-6 text-red-200">
                    Error: {error}
                </div>
            )}

            {documents.length === 0 ? (
                <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
                    <p className="text-gray-400 mb-4">No documents found.</p>
                    <button
                        onClick={createNewDocument}
                        className="text-indigo-400 hover:text-indigo-300 underline"
                    >
                        Create your first document
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            onClick={() => onSelectDocument(doc.id)}
                            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 p-4 rounded-lg cursor-pointer transition-all hover:border-indigo-500 flex justify-between items-center group"
                        >
                            <div className="flex-grow">
                                {editingId === doc.id ? (
                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                        <input
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white"
                                            autoFocus
                                        />
                                        <button onClick={() => saveTitle(doc.id)} className="text-green-400">✓</button>
                                        <button onClick={() => setEditingId(null)} className="text-gray-400">✕</button>
                                    </div>
                                ) : (
                                    <h3 className="font-medium text-lg mb-1 flex items-center gap-2">
                                        {doc.title || 'Untitled Document'}
                                        <button
                                            onClick={(e) => startRenaming(doc, e)}
                                            className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-gray-400"
                                            title="Rename"
                                        >
                                            ✎
                                        </button>
                                    </h3>
                                )}
                                <p className="text-sm text-gray-500">
                                    Last updated: {new Date(doc.updated_at).toLocaleString()}
                                </p>
                            </div>
                            <button
                                onClick={(e) => deleteDocument(doc.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-400 transition-all"
                                title="Delete Document"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
