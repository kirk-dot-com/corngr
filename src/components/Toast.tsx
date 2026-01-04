import React, { useEffect, useState } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'info' | 'error';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastProps {
    message: ToastMessage;
    onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => onDismiss(message.id), 300); // Match animation duration
        }, 3000);

        return () => clearTimeout(timer);
    }, [message.id, onDismiss]);

    const getIcon = () => {
        switch (message.type) {
            case 'success':
                return '✓';
            case 'error':
                return '✕';
            case 'info':
            default:
                return 'ℹ';
        }
    };

    return (
        <div className={`toast toast-${message.type} ${isExiting ? 'toast-exit' : ''}`}>
            <span className="toast-icon">{getIcon()}</span>
            <span className="toast-message">{message.message}</span>
            <button
                className="toast-close"
                onClick={() => {
                    setIsExiting(true);
                    setTimeout(() => onDismiss(message.id), 300);
                }}
                aria-label="Dismiss"
            >
                ✕
            </button>
        </div>
    );
};

interface ToastContainerProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <Toast key={toast.id} message={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
};

// Toast Manager Hook
export const useToast = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = (type: ToastType, message: string) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, type, message }]);
    };

    const dismissToast = (id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    return {
        toasts,
        showToast,
        dismissToast,
        success: (message: string) => showToast('success', message),
        info: (message: string) => showToast('info', message),
        error: (message: string) => showToast('error', message),
    };
};
