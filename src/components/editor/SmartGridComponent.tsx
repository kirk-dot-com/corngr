import React, { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
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
        gridMap.doc?.transact(() => {
            const yCols = gridMap.get('columns') as Y.Array<GridColumn>;
            const newColId = 'c' + Date.now();
            yCols.push([{
                id: newColId,
                name: type === 'magic' ? '✨ New Insight' : 'New Column',
                type,
                width: 150
            }]);
        });
    };

    // AI Mocks
    const handleAnalyzeGrid = () => {
        setAnalyzing(true);
        // Mock Z-Axis Analysis
        setTimeout(() => {
            gridMap.doc?.transact(() => {
                const analysisMap = new Y.Map();
                gridMap.set('analysis', analysisMap);
                analysisMap.set('insight', "⚠️ Correlation Detected: Hardware costs are 40% higher in Q1 compared to average. Consider deferring purchases.");
                analysisMap.set('timestamp', new Date().toISOString());
            });
            setAnalyzing(false);
        }, 1500);
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
