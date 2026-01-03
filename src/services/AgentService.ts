import * as Y from 'yjs';
import { sidecarStore } from '../stores/SidecarStore';

// Mock AI Service that "thinks" and interacts with the doc
class AgentService {

    async processPrompt(prompt: string, yDoc: Y.Doc) {
        sidecarStore.setThinking(true);

        // DELAY SIMULATION
        await new Promise(r => setTimeout(r, 1000));

        const lowerPrompt = prompt.toLowerCase();

        // 1. SIMPLE GREETINGS / Q&A
        if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi')) {
            sidecarStore.addMessage('assistant', "Hi there! How can I help you with this document?");
            sidecarStore.setThinking(false);
            return;
        }

        // 2. DOCUMENT ACTIONS
        // "Create a grid" / "Add a table"
        if (lowerPrompt.includes('grid') || lowerPrompt.includes('table')) {
            this.handleCreateGrid(yDoc);
            sidecarStore.addMessage('assistant', "I've added a new Smart Data Grid to your document. You can now use '✨ Magic Columns' to analyze data.");
            sidecarStore.setThinking(false);
            return;
        }

        // "Summarize" (Context Reading)
        if (lowerPrompt.includes('summarize')) {
            const summary = this.readDocumentContext(yDoc);
            sidecarStore.addMessage('assistant', `Here is a summary of the current document:\n\n"${summary}"\n\n(Note: This is a mock analysis of the active text blocks).`);
            sidecarStore.setThinking(false);
            return;
        }

        // Default Fallback
        sidecarStore.addMessage('assistant', "I'm listening. You can ask me to 'Create a grid', 'Summarize document', or 'Analyze data'.");
        sidecarStore.setThinking(false);
    }

    // --- TOOL: Create Smart Grid ---
    private handleCreateGrid(yDoc: Y.Doc) {
        // We need to inject a ProseMirror node. 
        // Direct Y.Doc manipulation for ProseMirror is complex because strictly it should be via Steps.
        // However, we can append to the Y.XmlFragment if we are "outside" the editor view, OR 
        // ideally, we should expose a "dispatch" method from the editor.
        // For this Prototype, we will append to the end of the Y.XmlFragment.

        const fragment = yDoc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;

        // Creating a raw XML element that matches ProseMirror's expectation for the schema
        // <smart_grid gridId="...">
        const gridId = Math.random().toString(36).substr(2, 9);
        const gridNode = new Y.XmlElement('smart_grid');
        gridNode.setAttribute('gridId', gridId);

        // Add a paragraph before for spacing
        const pNode = new Y.XmlElement('paragraph');

        // Transaction
        yDoc.transact(() => {
            fragment.push([pNode, gridNode]);
        });
    }

    // --- CONTEXT: Read Document ---
    private readDocumentContext(yDoc: Y.Doc): string {
        const fragment = yDoc.get('prosemirror', Y.XmlFragment) as Y.XmlFragment;
        let text = '';

        // Naive iteration
        for (let i = 0; i < fragment.length; i++) {
            const node = fragment.get(i);
            if (node instanceof Y.XmlElement) {
                // Simplified text extraction
                text += node.toString() + ' ';
            }
        }
        return text.substring(0, 200) + '...'; // Truncate
    }

    // --- API: Grid Analysis (Called from SmartGridComponent) ---
    async analyzeGrid(_gridId: string, _yDoc: Y.Doc) {
        return new Promise<{ insight: string }>((resolve) => {
            setTimeout(() => {
                resolve({
                    insight: "🤖 Agent Analysis: Detected an outlier in Row 2. 'License Y' cost is significantly below median."
                });
            }, 1500);
        });
    }

    // --- API: Magic Column (Called from SmartGridComponent) ---
    async fillMagicColumn(prompt: string, rowData: any) {
        return new Promise<string>((resolve) => {
            setTimeout(() => {
                if (prompt.includes('price') || prompt.includes('cost')) return resolve('$XXX');
                if (prompt.includes('category')) return resolve('Auto-Categorized');
                resolve(`AI Generated: ${prompt} for ${JSON.stringify(rowData).substr(0, 10)}...`);
            }, 800);
        });
    }
}

export const agentService = new AgentService();
