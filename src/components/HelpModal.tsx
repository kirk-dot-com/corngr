import React from 'react';

interface HelpModalProps {
    onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            ></div>
            <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl animate-fade-in-up">
                <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 p-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Corngr User Guide
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-8 prose prose-invert max-w-none text-gray-300">
                    <section className="mb-8">
                        <h3 className="text-white text-lg font-bold mb-4">Executive Summary</h3>
                        <p className="mb-4">
                            Corngr is a <strong>security-first, high-performance document editor</strong> designed for environments where data integrity, ownership, and speed are paramount. Unlike cloud editors that sacrifice privacy for convenience, Corngr uses a <strong>local-first, cryptographically verified architecture</strong>.
                        </p>
                    </section>

                    <hr className="border-gray-800 my-8" />

                    <div className="grid md:grid-cols-2 gap-8">
                        <section className="mb-6">
                            <h4 className="text-indigo-400 font-bold mb-2">1. Zero-Trust Security</h4>
                            <p className="text-sm mb-2 opacity-80">Every document is verified cryptographically on your local machine.</p>
                            <ul className="list-disc pl-5 text-sm space-y-1">
                                <li><strong>Total Ownership:</strong> You hold the keys.</li>
                                <li><strong>Tamper-Proof:</strong> Signatures validate every change.</li>
                            </ul>
                        </section>

                        <section className="mb-6">
                            <h4 className="text-indigo-400 font-bold mb-2">2. High-Performance Tokens</h4>
                            <p className="text-sm mb-2 opacity-80">Security checks shouldn't be slow. Corngr uses capability tokens for speed.</p>
                            <ul className="list-disc pl-5 text-sm space-y-1">
                                <li><strong>20x Faster:</strong> Initial check ~120ms &rarr; Subseq ~5ms.</li>
                                <li><strong>Invisible Security:</strong> Safety without the lag.</li>
                            </ul>
                        </section>

                        <section className="mb-6">
                            <h4 className="text-indigo-400 font-bold mb-2">3. Live Transclusion</h4>
                            <p className="text-sm mb-2 opacity-80">Don't copy-paste. Embed live references to data blocks.</p>
                            <ul className="list-disc pl-5 text-sm space-y-1">
                                <li><strong>Single Source of Truth:</strong> Updates propagate everywhere.</li>
                                <li><strong>Data Lineage:</strong> Verify author and origin instantly.</li>
                            </ul>
                        </section>

                        <section className="mb-6">
                            <h4 className="text-indigo-400 font-bold mb-2">4. Dual-View (Docs + Slides)</h4>
                            <p className="text-sm mb-2 opacity-80">Your content adapts. Write as a doc, present as slides.</p>
                            <ul className="list-disc pl-5 text-sm space-y-1">
                                <li><strong>Instant Conversion:</strong> No more manual copy-pasting to PowerPoint.</li>
                                <li><strong>Always In-Sync:</strong> Edits in one view update the other.</li>
                            </ul>
                        </section>
                    </div>

                    <hr className="border-gray-800 my-8" />

                    <section className="mb-8">
                        <h3 className="text-white text-lg font-bold mb-4">5. Local-First Cloud Sync</h3>
                        <p className="mb-4">
                            Corngr saves to your local disk first (0ms latency), then syncs to the encrypted cloud.
                        </p>
                        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                            <strong>Why it matters:</strong>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li>Works 100% Offline</li>
                                <li>Never lose work due to bad Wi-Fi</li>
                                <li>Instant Restore on new devices</li>
                            </ul>
                        </div>
                    </section>

                    <section className="mb-8">
                        <h3 className="text-white text-lg font-bold mb-4">6. Developer & Demo Tools</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-800 rounded border border-gray-700">
                                <div className="font-bold text-indigo-300 mb-1">🌐 +Transclude</div>
                                <div className="text-xs">Inserts a mock secure reference to test permission resolution for remote data.</div>
                            </div>
                            <div className="p-4 bg-gray-800 rounded border border-gray-700">
                                <div className="font-bold text-indigo-300 mb-1">🚀 1k Blocks</div>
                                <div className="text-xs">Stress tests the rendering engine with 1,000 blocks to verify scrolling performance.</div>
                            </div>
                            <div className="p-4 bg-gray-800 rounded border border-gray-700">
                                <div className="font-bold text-indigo-300 mb-1">⚡ Auto-Mutate</div>
                                <div className="text-xs">Simulates high-frequency updates (50ms) to test Real-Time sync and Slide view reactivity.</div>
                            </div>
                            <div className="p-4 bg-gray-800 rounded border border-gray-700">
                                <div className="font-bold text-indigo-300 mb-1">🧪 Stress Test</div>
                                <div className="text-xs">Runs automated benchmark suite for Latency, Throughput, and Redaction speed.</div>
                            </div>
                        </div>
                    </section>

                    <div className="text-center text-gray-500 text-sm mt-12 italic">
                        Corngr is not just an editor; it's a secure data operating system for your critical information.
                    </div>
                </div>
            </div>
        </div>
    );
};
