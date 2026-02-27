import React from 'react';

interface AuditBadgeProps {
    intact: boolean;
}

export const AuditBadge: React.FC<AuditBadgeProps> = ({ intact }) => {
    return (
        <div className="widget-card">
            <div className="widget-label">🔐 Audit Integrity</div>
            <div className="widget-value" style={{ fontSize: '0.95rem', marginTop: 8 }}>
                {intact ? (
                    <span className="audit-badge-intact">
                        <span className="pulse-dot" />
                        CHAIN INTACT
                    </span>
                ) : (
                    <span className="audit-badge-failed">
                        <span className="pulse-dot" style={{ animationDuration: '0.6s' }} />
                        TAMPER DETECTED
                    </span>
                )}
            </div>
            <div className="widget-sub" style={{ marginTop: 8 }}>
                {intact
                    ? 'Merkle chain verified — all envelopes consistent'
                    : '⚠ Audit log tampered — review erp_audit.jsonl'}
            </div>
        </div>
    );
};
