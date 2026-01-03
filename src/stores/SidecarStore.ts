import { Action } from "../security/types"; // Re-using generic types if useful, or define local

type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
    id: string;
    role: Role;
    content: string;
    timestamp: number;
}

class SidecarStore {
    messages: ChatMessage[] = [];
    isOpen: boolean = false;
    isThinking: boolean = false;
    listeners: Set<() => void> = new Set();

    constructor() {
        // Initial welcome message
        this.addMessage('system', 'Hello! I am your Corngr AI Assistant. I can help you draft content, analyze data grids, or organize your workspace.');
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach(l => l());
    }

    toggle(force?: boolean) {
        this.isOpen = force !== undefined ? force : !this.isOpen;
        this.notify();
    }

    setThinking(thinking: boolean) {
        this.isThinking = thinking;
        this.notify();
    }

    addMessage(role: Role, content: string) {
        const msg: ChatMessage = {
            id: Math.random().toString(36).substr(2, 9),
            role,
            content,
            timestamp: Date.now()
        };
        this.messages = [...this.messages, msg];
        this.notify();
    }

    getMessages() {
        return this.messages;
    }
}

export const sidecarStore = new SidecarStore();
