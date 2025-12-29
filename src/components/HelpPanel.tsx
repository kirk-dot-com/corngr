import React from 'react';

interface HelpPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed top-0 right-0 bottom-0 w-[500px] z-[1000] shadow-2xl transition-all duration-300 transform translate-x-0 bg-gray-900 border-l border-gray-700 overflow-hidden flex flex-col">
            <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="text-xl">🌽</span>
                    <h2 className="text-xl font-bold text-white">Corngr User Guide</h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-white"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 text-gray-300 prose prose-invert max-w-none">
                <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl mb-8">
                    <p className="text-sm text-indigo-200 m-0">
                        <strong>Pro Tip:</strong> This panel stays open while you work! Use it to reference shortcuts and features in real-time.
                    </p>
                </div>

                <section className="mb-8">
                    <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="text-indigo-400">01</span> Zero-Trust Security
                    </h3>
                    <p className="text-sm mb-4 leading-relaxed">
                        Every document is verified cryptographically on your local machine. Corngr uses a <strong>local-first architecture</strong> where you hold the keys.
                    </p>
                    <ul className="list-disc pl-5 text-sm space-y-2 opacity-80">
                        <li><strong>Tamper-Proof:</strong> Ed25519 signatures validate every single block change.</li>
                        <li><strong>Total Ownership:</strong> Your data never leaves your device unencrypted.</li>
                    </ul>
                </section>

                <hr className="border-gray-800 my-8" />

                <section className="mb-8">
                    <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="text-indigo-400">02</span> Live Transclusion
                    </h3>
                    <p className="text-sm mb-4 leading-relaxed">
                        Don't copy-paste data. Use <strong>Inline References</strong> to embed live blocks from other documents.
                    </p>
                    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                        <p className="text-xs font-mono text-indigo-300 mb-2">How it works:</p>
                        <p className="text-xs opacity-70 m-0">
                            When you change the source document, every transcluded reference updates instantly across all users and devices.
                        </p>
                    </div>
                </section>

                <hr className="border-gray-800 my-8" />

                <section className="mb-8">
                    <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="text-indigo-400">03</span> Capability Tokens
                    </h3>
                    <p className="text-sm mb-4">
                        High-security usually means high-latency. Corngr solves this with <strong>Capability Tokens</strong>.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Standard Check</p>
                            <p className="text-sm text-red-400 font-bold">~120ms</p>
                        </div>
                        <div className="p-3 bg-indigo-900/30 rounded-lg border border-indigo-500/30">
                            <p className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold mb-1">Token Check</p>
                            <p className="text-sm text-green-400 font-bold">~5ms</p>
                        </div>
                    </div>
                </section>

                <hr className="border-gray-800 my-8" />

                <section className="mb-8">
                    <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="text-indigo-400">04</span> Dual-View Editing
                    </h3>
                    <p className="text-sm mb-4">
                        Switch between 📝 <strong>Document</strong> and 📊 <strong>Slides</strong> view.
                    </p>
                    <ul className="list-disc pl-5 text-sm space-y-2 opacity-80">
                        <li><strong>Instant Conversion:</strong> No more PowerPoint exports.</li>
                        <li><strong>Yjs Powered:</strong> Real-time collaboration in both views.</li>
                    </ul>
                </section>

                <section className="mt-12 p-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700">
                    <h4 className="text-white font-bold mb-2">🌐 Browser Sync Note</h4>
                    <p className="text-xs opacity-70 leading-relaxed mb-0">
                        In browser mode, Corngr uses cloud-only sync via Supabase. Local file system saving is disabled to protect your host OS.
                    </p>
                </section>

                <div className="text-center text-gray-500 text-[10px] mt-12 uppercase tracking-widest font-bold">
                    Corngr Prototype v6.5 • Secure Data OS
                </div>
            </div>
        </div>
    );
};

