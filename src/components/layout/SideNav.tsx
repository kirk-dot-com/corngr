import React from 'react';
import { User } from '../../security/types';
import './WorkspaceLayout.css'; // Shared styles

export type ViewMode = 'split' | 'editor' | 'slides' | 'governance';

interface SideNavProps {
    currentView: ViewMode;
    currentUser: User;
    onViewChange: (view: ViewMode) => void;
    onRoleChange: () => void;
}

export const SideNav: React.FC<SideNavProps> = ({
    currentView,
    currentUser,
    onViewChange,
    onRoleChange
}) => {

    const roleInitial = currentUser.attributes.role.charAt(0).toUpperCase();
    const roleClass = currentUser.attributes.role; // 'admin', 'editor', 'viewer'

    return (
        <nav className="side-nav">
            {/* App Switcher */}
            <button
                className={`nav-item ${currentView === 'split' ? 'active' : ''}`}
                onClick={() => onViewChange('split')}
                title="Split View"
            >
                🌓
            </button>
            <button
                className={`nav-item ${currentView === 'editor' ? 'active' : ''}`}
                onClick={() => onViewChange('editor')}
                title="Editor Mode"
            >
                📝
            </button>
            <button
                className={`nav-item ${currentView === 'slides' ? 'active' : ''}`}
                onClick={() => onViewChange('slides')}
                title="Presentation Mode"
            >
                📊
            </button>
            <button
                className={`nav-item ${currentView === 'governance' ? 'active' : ''}`}
                onClick={() => onViewChange('governance')}
                title="Governance Dashboard"
            >
                🛡️
            </button>

            <div className="nav-spacer"></div>

            {/* User Profile / Role Switcher */}
            <div
                className={`nav-item user-profile-icon ${roleClass}`}
                onClick={onRoleChange}
                title={`Current Role: ${currentUser.attributes.role} (Click to Switch)`}
            >
                {roleInitial}
            </div>
        </nav>
    );
};
