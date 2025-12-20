import React, { useState, useEffect } from 'react';
import { BlockMetadata } from '../yjs/schema';
import { MetadataStore } from '../metadata/MetadataStore';
import { User } from '../security/types';
import './MetadataPanel.css';

interface MetadataPanelProps {
    selectedBlockId: string | null;
    metadataStore: MetadataStore;
    user: User;
    onClose: () => void;
    onSave?: () => void;
}

/**
 * Metadata Panel UI Component
 * Phase 2.3: Allows admin/editor users to edit block metadata
 * 
 * Features:
 * - Classification dropdown
 * - ACL editor (add/remove users/roles)
 * - Lock toggle
 * - Provenance viewer (read-only)
 */
export const MetadataPanel: React.FC<MetadataPanelProps> = ({
    selectedBlockId,
    metadataStore,
    user,
    onClose,
    onSave
}) => {
    const [metadata, setMetadata] = useState<BlockMetadata>({});
    const [aclInput, setAclInput] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    // Load metadata when block selection changes
    useEffect(() => {
        if (selectedBlockId) {
            const existingMetadata = metadataStore.get(selectedBlockId);
            setMetadata(existingMetadata || {});
            setHasChanges(false);
        }
    }, [selectedBlockId, metadataStore]);

    // Check if user has permission to edit metadata
    const canEdit = user.attributes.role === 'admin' || user.attributes.role === 'editor';

    if (!selectedBlockId) {
        return (
            <div className="metadata-panel metadata-panel-empty">
                <div className="panel-header">
                    <h3>Metadata</h3>
                    <button className="close-button" onClick={onClose}>✕</button>
                </div>
                <div className="panel-body">
                    <p className="empty-message">Select a block to view/edit metadata</p>
                </div>
            </div>
        );
    }

    if (!canEdit) {
        return (
            <div className="metadata-panel metadata-panel-readonly">
                <div className="panel-header">
                    <h3>Metadata (Read-Only)</h3>
                    <button className="close-button" onClick={onClose}>✕</button>
                </div>
                <div className="panel-body">
                    <div className="metadata-field">
                        <label>Classification</label>
                        <div className="readonly-value">
                            {metadata.classification || 'None'}
                        </div>
                    </div>
                    {metadata.locked && (
                        <div className="metadata-field">
                            <span className="lock-badge">🔒 Locked</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const handleClassificationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newClassification = e.target.value as BlockMetadata['classification'];
        setMetadata({ ...metadata, classification: newClassification });
        setHasChanges(true);
    };

    const handleLockToggle = () => {
        // Only admin can lock/unlock
        if (user.attributes.role === 'admin') {
            setMetadata({ ...metadata, locked: !metadata.locked });
            setHasChanges(true);
        }
    };

    const handleAddACL = () => {
        if (!aclInput.trim()) return;

        const currentACL = metadata.acl || [];
        if (!currentACL.includes(aclInput.trim())) {
            setMetadata({
                ...metadata,
                acl: [...currentACL, aclInput.trim()]
            });
            setAclInput('');
            setHasChanges(true);
        }
    };

    const handleRemoveACL = (item: string) => {
        const currentACL = metadata.acl || [];
        setMetadata({
            ...metadata,
            acl: currentACL.filter(i => i !== item)
        });
        setHasChanges(true);
    };

    const handleSave = () => {
        if (selectedBlockId) {
            // Validate: restricted classification requires ACL
            if (metadata.classification === 'restricted' && (!metadata.acl || metadata.acl.length === 0)) {
                alert('⚠️ Restricted classification requires at least one ACL entry');
                return;
            }

            metadataStore.set(selectedBlockId, metadata);
            setHasChanges(false);

            if (onSave) {
                onSave(); // Trigger parent to save document
            }
        }
    };

    const handleReset = () => {
        const existingMetadata = metadataStore.get(selectedBlockId!);
        setMetadata(existingMetadata || {});
        setHasChanges(false);
    };

    return (
        <div className="metadata-panel">
            <div className="panel-header">
                <h3>Security Metadata</h3>
                <button className="close-button" onClick={onClose}>✕</button>
            </div>

            <div className="panel-body">
                <div className="block-info">
                    <small>Block ID: <code>{selectedBlockId.substring(0, 8)}...</code></small>
                </div>

                {/* Classification Selector */}
                <div className="metadata-field">
                    <label htmlFor="classification">Classification Level</label>
                    <select
                        id="classification"
                        value={metadata.classification || ''}
                        onChange={handleClassificationChange}
                        className="classification-select"
                    >
                        <option value="">None (Public)</option>
                        <option value="public">Public</option>
                        <option value="internal">Internal</option>
                        <option value="confidential">Confidential</option>
                        <option value="restricted">Restricted</option>
                    </select>
                    <small className="field-hint">
                        Determines minimum clearance level required to view
                    </small>
                </div>

                {/* ACL Editor */}
                <div className="metadata-field">
                    <label htmlFor="acl">Access Control List (ACL)</label>

                    <div className="acl-input-group">
                        <input
                            id="acl"
                            type="text"
                            value={aclInput}
                            onChange={(e) => setAclInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddACL()}
                            placeholder="User ID or role name"
                            className="acl-input"
                        />
                        <button onClick={handleAddACL} className="add-button">
                            Add
                        </button>
                    </div>

                    <small className="field-hint">
                        Specify user IDs or roles (e.g., "admin", "editor", "user-123")
                    </small>

                    {metadata.acl && metadata.acl.length > 0 && (
                        <div className="acl-list">
                            {metadata.acl.map((item, index) => (
                                <div key={index} className="acl-item">
                                    <span className="acl-value">{item}</span>
                                    <button
                                        onClick={() => handleRemoveACL(item)}
                                        className="remove-button"
                                        title="Remove"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Lock Toggle (Admin Only) */}
                {user.attributes.role === 'admin' && (
                    <div className="metadata-field">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={metadata.locked || false}
                                onChange={handleLockToggle}
                            />
                            <span>🔒 Lock for editing (Admin only)</span>
                        </label>
                        <small className="field-hint">
                            Locked blocks can only be edited by admins
                        </small>
                    </div>
                )}

                {/* Provenance Viewer (Read-Only) */}
                {metadata.provenance && (
                    <div className="metadata-field provenance-field">
                        <label>Data Provenance</label>
                        <div className="provenance-info">
                            <div>
                                <strong>Source:</strong> {metadata.provenance.sourceId}
                            </div>
                            <div>
                                <strong>Author:</strong> {metadata.provenance.authorId}
                            </div>
                            <div>
                                <strong>Modified:</strong>{' '}
                                {new Date(metadata.provenance.timestamp).toLocaleString()}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="panel-footer">
                <button
                    onClick={handleReset}
                    disabled={!hasChanges}
                    className="secondary-button"
                >
                    Reset
                </button>
                <button
                    onClick={handleSave}
                    disabled={!hasChanges}
                    className="primary-button"
                >
                    Save Metadata
                </button>
            </div>

            {/* Validation Warning */}
            {metadata.classification === 'restricted' && (!metadata.acl || metadata.acl.length === 0) && (
                <div className="validation-warning">
                    ⚠️ Restricted classification requires at least one ACL entry
                </div>
            )}
        </div>
    );
};
