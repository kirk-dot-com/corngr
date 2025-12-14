import React from 'react';
import { EditorView } from 'prosemirror-view';
import { toggleMark, setBlockType } from 'prosemirror-commands';
import { corngrSchema, createVariableNode } from './schema';
import { createVariableBlock } from '../yjs/schema';
import * as Y from 'yjs';
import './toolbar.css';

interface ToolbarProps {
    editorView: EditorView | null;
    yDoc: Y.Doc;
}

export const Toolbar: React.FC<ToolbarProps> = ({ editorView, yDoc }) => {
    const executeCommand = (command: any) => {
        if (!editorView) return;
        command(editorView.state, editorView.dispatch);
        editorView.focus();
    };

    const toggleBold = () => {
        executeCommand(toggleMark(corngrSchema.marks.strong));
    };

    const toggleItalic = () => {
        executeCommand(toggleMark(corngrSchema.marks.em));
    };

    const toggleCode = () => {
        executeCommand(toggleMark(corngrSchema.marks.code));
    };

    const makeHeading = (level: number) => {
        executeCommand(setBlockType(corngrSchema.nodes.heading, { level }));
    };

    const makeParagraph = () => {
        executeCommand(setBlockType(corngrSchema.nodes.paragraph));
    };

    const insertVariable = () => {
        if (!editorView) return;

        const name = prompt('Variable name:', 'myVariable');
        if (!name) return;

        const value = prompt('Initial value:', '0');
        if (value === null) return;

        const format = prompt('Format (text/currency/number/percentage):', 'text');
        if (!format) return;

        // Create variable block in Yjs
        const blockId = createVariableBlock(
            yDoc,
            name,
            format === 'currency' || format === 'number' ? parseFloat(value) || 0 : value,
            format as any
        );

        // Insert variable node in ProseMirror
        const { state, dispatch } = editorView;
        const variableNode = createVariableNode(blockId, name, value, format);

        const tr = state.tr.replaceSelectionWith(variableNode);
        dispatch(tr);

        editorView.focus();
    };

    const isActive = (type: 'bold' | 'italic' | 'code'): boolean => {
        if (!editorView) return false;

        const { state } = editorView;
        const mark = type === 'bold'
            ? corngrSchema.marks.strong
            : type === 'italic'
                ? corngrSchema.marks.em
                : corngrSchema.marks.code;

        return !!mark.isInSet(state.storedMarks || state.selection.$from.marks());
    };

    return (
        <div className="toolbar">
            <div className="toolbar-group">
                <button
                    className={`toolbar-btn ${isActive('bold') ? 'active' : ''}`}
                    onClick={toggleBold}
                    title="Bold (Cmd+B)"
                >
                    <strong>B</strong>
                </button>
                <button
                    className={`toolbar-btn ${isActive('italic') ? 'active' : ''}`}
                    onClick={toggleItalic}
                    title="Italic (Cmd+I)"
                >
                    <em>I</em>
                </button>
                <button
                    className={`toolbar-btn ${isActive('code') ? 'active' : ''}`}
                    onClick={toggleCode}
                    title="Code"
                >
                    {'</>'}
                </button>
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-group">
                <button
                    className="toolbar-btn"
                    onClick={makeParagraph}
                    title="Paragraph"
                >
                    ¶
                </button>
                <button
                    className="toolbar-btn"
                    onClick={() => makeHeading(1)}
                    title="Heading 1"
                >
                    H1
                </button>
                <button
                    className="toolbar-btn"
                    onClick={() => makeHeading(2)}
                    title="Heading 2"
                >
                    H2
                </button>
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-group">
                <button
                    className="toolbar-btn toolbar-btn-variable"
                    onClick={insertVariable}
                    title="Insert Variable"
                >
                    🔗 Variable
                </button>
            </div>
        </div>
    );
};
