import React, { useState, useEffect } from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    showCancel?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
}

/**
 * ConfirmModal - Reusable confirmation dialog component
 * 
 * Used for sign/seal confirmations and info displays in block gutters.
 * Matches InputModal styling with glassmorphism and purple gradient design.
 * 
 * Phase 5: Polish - Extracted from inline GutterPlugin implementation
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'OK',
    showCancel = false,
    onConfirm,
    onCancel
}) => {
    useEffect(() => {
        if (!isOpen) return;

        // Handle ESC key
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && onCancel) {
                onCancel();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-fade-in">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onCancel}
            ></div>

            {/* Modal content */}
            <div className="relative bg-gradient-to-br from-gray-900/95 to-gray-800/98 border border-indigo-500/30 rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-4 font-['Outfit']">
                        {title}
                    </h3>

                    <p className="text-white/80 leading-relaxed whitespace-pre-wrap mb-6 text-sm">
                        {message}
                    </p>

                    <div className="flex justify-end gap-3">
                        {showCancel && onCancel && (
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            onClick={onConfirm}
                            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-indigo-900/40 hover:scale-105"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slide-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease;
                }
                .animate-slide-up {
                    animation: slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
            `}</style>
        </div>
    );
};

