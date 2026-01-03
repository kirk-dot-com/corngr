import React, { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { agentService } from '../../services/AgentService';
import { sidecarStore } from '../../stores/SidecarStore';
import './SmartGridComponent.css';

interface SmartGridProps {
    gridId: string;
    yDoc: Y.Doc;
}

interface GridColumn {
    id: string;
    name: string;
    type: 'text' | 'number' | 'date' | 'magic';
    width: number;
    prompt?: string;
}

interface GridRow {
    id: string;
    cells: { [colId: string]: any };
}

export const SmartGridComponent: React.FC<SmartGridProps> = ({ gridId, yDoc }) => {
    // Determine the Y.Map for this grid
    const gridMap = yDoc.getMap(`grid_${gridId}`);

    // State
    const [columns, setColumns] = useState<GridColumn[]>([]);
    const [rows, setRows] = useState<GridRow[]>([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<{ insight: string, timestamp: string } | null>(null);

    // Initialize Mock Data if empty
    useEffect(() => {
        if (!gridMap.has('columns')) {
            const cols = new Y.Array();
            cols.push([
                { id: 'c1', name: 'Item', type: 'text', width: 150 },
                { id: 'c2', name: 'Cost', type: 'number', width: 100 },
                { id: 'c3', name: 'Category', type: 'text', width: 120 }
            ]);
            gridMap.set('columns', cols);

            const rowArr = new Y.Array();
            rowArr.push([{ id: 'r1', cells: { c1: 'Server X', c2: 1200, c3: 'Hardware' } }]);
            rowArr.push([{ id: 'r2', cells: { c1: 'License Y', c2: 300, c3: 'Software' } }]);
            gridMap.set('rows', rowArr);
        }
    }, [gridMap]);

    // Data Binding
    useEffect(() => {
        const updateState = () => {
            const yCols = gridMap.get('columns') as Y.Array<GridColumn>;
            const yRows = gridMap.get('rows') as Y.Array<GridRow>;
            const yAnalysis = gridMap.get('analysis') as Y.Map<any>;

            if (yCols) setColumns(yCols.toArray());
            if (yRows) setRows(yRows.toArray());
            if (yAnalysis && yAnalysis.has('insight')) {
                setAnalysisResult(yAnalysis.toJSON() as any);
            }
        };

        gridMap.observeDeep(updateState);
        updateState();

        return () => gridMap.unobserveDeep(updateState);
    }, [gridMap]);

    // Handlers
    const handleUpdateCell = (rowId: string, colId: string, value: any) => {
        gridMap.doc?.transact(() => {
            const yRows = gridMap.get('rows') as Y.Array<GridRow>;
            const index = yRows.toArray().findIndex(r => r.id === rowId);
            if (index !== -1) {
                const row = yRows.get(index);
                const newCells = { ...row.cells, [colId]: value };
                yRows.delete(index, 1);
                yRows.insert(index, [{ ...row, cells: newCells }]);
            }
        });
    };

    const handleAddRow = () => {
        gridMap.doc?.transact(() => {
            const yRows = gridMap.get('rows') as Y.Array<GridRow>;
            const newRowId = Math.random().toString(36).substr(2, 9);
            yRows.push([{ id: newRowId, cells: {} }]);
        });
    };

    const handleAddColumn = (type: 'text' | 'magic') => {
        const name = type === 'magic' ? prompt("Enter AI Prompt for Column (e.g. 'Categorize Item')") : 'New Column';
        if (type === 'magic' && !name) return;

        gridMap.doc?.transact(() => {
            const yCols = gridMap.get('columns') as Y.Array<GridColumn>;
            const newColId = 'c' + Date.now();
            yCols.push([{
                id: newColId,
                name: name || 'Column',
                type,
                width: 150
            }]);

            // If magic, trigger agent to populate immediately (mock)
            if (type === 'magic') {
                populateMagicColumn(newColId, name || '', yCols.length - 1);
            }
        });
    };

    const populateMagicColumn = async (colId: string, prompt: string, colIndex: number) => {
        // In real app, this would queue a job. Here we iterate and mock.
        sidecarStore.setThinking(true);
        const yRows = gridMap.get('rows') as Y.Array<GridRow>;

        for (let i = 0; i < yRows.length; i++) {
            const row = yRows.get(i);
            const val = await agentService.fillMagicColumn(prompt, row.cells);
            handleUpdateCell(row.id, colId, val);
        }
        sidecarStore.setThinking(false);
    };

    // AI Analysis via AgentService
    const handleAnalyzeGrid = async () => {
        setAnalyzing(true);
        sidecarStore.setThinking(true);
        try {
            const result = await agentService.analyzeGrid(gridId, yDoc);

            gridMap.doc?.transact(() => {
                const analysisMap = new Y.Map();
                gridMap.set('analysis', analysisMap);
                analysisMap.set('insight', result.insight);
                analysisMap.set('timestamp', new Date().toISOString());
            });

            // Notify via Sidecar as well
            sidecarStore.addMessage('assistant', `I've analyzed the grid. ${result.insight}`);
            sidecarStore.toggle(true);

        } catch (e) {
            console.error(e);
        } finally {
            setAnalyzing(false);
            sidecarStore.setThinking(false);
        }
    };

    return (
        <div className="smart-grid-wrapper">
            <div className="smart-grid-header">
                <div className="grid-title">Smart Data Grid</div>
                <div className="grid-actions">
                    <button className="grid-btn" onClick={() => handleAddColumn('text')}>+ Column</button>
                    <button className="grid-btn magic" onClick={() => handleAddColumn('magic')}>+ ✨ Magic Column</button>
                    <button className="grid-btn analyze" onClick={handleAnalyzeGrid}>
                        {analyzing ? 'Analyzing...' : '⚡ Analyze Grid'}
                    </button>
                </div>
            </div>

            {analysisResult && (
                <div className="analysis-overlay">
                    <div className="analysis-content">
                        <strong>AI Insight:</strong> {analysisResult.insight}
                        <span className="analysis-close" onClick={() => {
                            gridMap.doc?.transact(() => gridMap.set('analysis', new Y.Map()));
                        }}>&times;</span>
                    </div>
                </div>
            )}

            <div className="smart-grid-container-scroll">
                <table className="smart-grid-table">
                    <thead>
                        <tr>
                            {columns.map(col => (
                                <th key={col.id} style={{ width: col.width }}>
                                    {col.type === 'magic' && '✨'} {col.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr key={row.id}>
                                {columns.map(col => (
                                    <td key={col.id}>
                                        <input
                                            type={col.type === 'number' ? 'number' : 'text'}
                                            value={row.cells[col.id] || ''}
                                            onChange={(e) => handleUpdateCell(row.id, col.id, e.target.value)}
                                            placeholder={col.type === 'magic' ? 'Generating...' : ''}
                                            className={col.type === 'magic' ? 'magic-cell' : ''}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button className="add-row-btn" onClick={handleAddRow}>+ Add Row</button>
        </div>
    );
};
