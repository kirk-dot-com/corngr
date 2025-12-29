import React from 'react';

interface HelpPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed top-0 right-0 bottom-0 w-[450px] z-[1000] shadow-2xl transition-all duration-300 transform translate-x-0 bg-gray-900 border-l border-gray-700 overflow-hidden flex flex-col">
            <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">User Guide</h2>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-white"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 text-gray-300 prose prose-invert max-w-none">
                <div className="bg-indigo-900/30 border border-indigo-700/50 p-4 rounded-lg mb-8">
                    <p className="text-sm font-medium text-indigo-200">
                        💡 <strong>Quick Tip:</strong> You can keep this guide open while you type!
                    </p>
                </div>

                <section className="mb-8">
                    <h3 className="text-white text-lg font-bold mb-3">🚀 Getting Started</h3>
                    <p className="mb-2 text-sm">
                        1. <strong>Create:</strong> Click the <span className="text-green-400">➕ New</span> button in the header to start a fresh document.
                    </p>
                    <p className="mb-2 text-sm">
                        2. <strong>Save:</strong> The app auto-saves to the cloud every second, but you can force a backup by clicking <span className="text-yellow-400">💾 Save</span>.
                    </p>
                    <p className="mb-2 text-sm">
                        3. <strong>Sync:</strong> To see content on another device, make sure you open the <strong>same document name</strong> from the dashboard.
                    </p>
                </section>

                <hr className="border-gray-800 my-6" />

                <section className="mb-8">
                    <h3 className="text-white text-lg font-bold mb-3">🛡️ Security Features</h3>
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-indigo-400 font-bold text-sm mb-1">Zero-Trust Signature</h4>
                            <p className="text-xs opacity-80">Every change is cryptographically signed locally. Tampering is impossible.</p>
                        </div>
                        <div>
                            <h4 className="text-indigo-400 font-bold text-sm mb-1">Capability Tokens</h4>
                            <p className="text-xs opacity-80">Fast permission checks (<5ms) without sacrificing strict security.</p>
                        </div>
                    </div>
                </section>

                <section className="mb-8">
                    <h3 className="text-white text-lg font-bold mb-3">🔄 Real-Time Sync</h3>
                    <p className="text-sm mb-4">
                        Corngr uses Supabase Realtime to push updates between instances.
                    </p>
                    <div className="bg-gray-800 p-3 rounded border border-gray-700 text-xs">
                        <strong>Troubleshooting Sync:</strong>
                        <ul className="list-disc pl-4 mt-2 space-y-2 opacity-80">
                            <li>Ensure both instances show "SUBSCRIBED" in the browser console.</li>
                            <li>Wait 1-2 seconds for cloud propagation.</li>
                            <li>Close extra tabs if you see "Insufficient resources" errors.</li>
                        </ul>
                    </div>
                </section>

                <section className="mb-8">
                    <h3 className="text-white text-lg font-bold mb-3">🎭 View Modes</h3>
                    <ul className="list-disc pl-5 text-sm space-y-2">
                        <li><strong>Dual View:</strong> Edit text on the left, see slides update in real-time on the right.</li>
                        <li><strong>Slides:</strong> Presentations generated instantly from your document blocks.</li>
                    </ul>
                </section>

                <div className="text-center text-gray-500 text-xs mt-12 italic border-t border-gray-800 pt-6">
                    Corngr Prototype v6.5 • Secure Data OS
                </div>
            </div>
        </div>
    );
};
