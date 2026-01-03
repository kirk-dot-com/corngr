import React, { useEffect, useState, useRef } from 'react';
import { sidecarStore, ChatMessage } from '../../stores/SidecarStore'; // Fixed: ../../
import { agentService } from '../../services/AgentService';   // Fixed: ../../
import * as Y from 'yjs';
import './SidecarPanel.css';

interface SidecarPanelProps {
    yDoc: Y.Doc;
}

export const SidecarPanel: React.FC<SidecarPanelProps> = ({ yDoc }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Subscribe to Store
    useEffect(() => {
        const update = () => {
            setIsOpen(sidecarStore.isOpen);
            setMessages(sidecarStore.getMessages());
            setIsThinking(sidecarStore.isThinking);
        };

        // Initial state
        update();

        const unsubscribe = sidecarStore.subscribe(update);
        return () => { unsubscribe(); };
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const prompt = inputValue;
        setInputValue('');

        // 1. Add User Message
        sidecarStore.addMessage('user', prompt);

        // 2. Send to Agent
        await agentService.processPrompt(prompt, yDoc);
    };

    if (!isOpen) return null;

    return (
        <div className="sidecar-panel">
            <div className="sidecar-header">
                <h3>✨ AI Companion</h3>
                <button className="close-btn" onClick={() => sidecarStore.toggle(false)}>
                    &times;
                </button>
            </div>

            <div className="sidecar-messages">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.role}`}>
                        <div className="message-role">
                            {msg.role === 'assistant' ? '🤖' : '👤'}
                        </div>
                        <div className="message-content">
                            {msg.content}
                        </div>
                    </div>
                ))}

                {isThinking && (
                    <div className="message assistant thinking">
                        <div className="message-role">🤖</div>
                        <div className="message-content">
                            <span className="dot">.</span>
                            <span className="dot">.</span>
                            <span className="dot">.</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form className="sidecar-input" onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Ask about this document..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    autoFocus
                />
                <button type="submit" disabled={!inputValue.trim() || isThinking}>
                    Send
                </button>
            </form>
        </div>
    );
};
