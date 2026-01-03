import React, { useEffect, useState, useRef } from 'react';
import { sidecarStore, ChatMessage } from '../stores/SidecarStore';
import { agentService } from '../services/AgentService';
import * as Y from 'yjs';
import './SidecarPanel.css';

interface SidecarPanelProps {
    yDoc: Y.Doc;
}

export const SidecarPanel: React.FC<SidecarPanelProps> = ({ yDoc }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Subscribe to Store
    useEffect(() => {
        const update = () => {
            setMessages(sidecarStore.getMessages());
            setIsThinking(sidecarStore.isThinking);
        };
        update();
        return sidecarStore.subscribe(update);
    }, []);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const p = input;
        setInput('');

        // Add User Message
        sidecarStore.addMessage('user', p);

        // Call Agent
        await agentService.processPrompt(p, yDoc);
    };

    if (!sidecarStore.isOpen) return null;

    return (
        <div className="sidecar-panel">
            <div className="sidecar-header">
                <h3>🤖 AI Companion</h3>
                <button className="close-btn" onClick={() => sidecarStore.toggle(false)}>×</button>
            </div>

            <div className="sidecar-messages">
                {messages.map(msg => (
                    <div key={msg.id} className={`message ${msg.role}`}>
                        <div className="message-content">{msg.content}</div>
                        <div className="message-time">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                ))}

                {isThinking && (
                    <div className="message assistant thinking">
                        <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form className="sidecar-input" onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Ask AI to edit doc..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={isThinking}
                />
                <button type="submit" disabled={isThinking || !input.trim()}>Send</button>
            </form>
        </div>
    );
};
