"use client";

import React, { useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { useNoCodeBuilder, useNoCodeActions } from '@/lib/no-code/state-management';
import { cn } from '@/lib/utils';

interface ReteEditorProps {
  onNodeChange?: (nodes: any[]) => void;
  onConnectionChange?: (connections: any[]) => void;
  onEditorChange?: (data: any) => void;
  initialData?: any;
  className?: string;
}

export interface ReteEditorRef {
  addNode: (type: string, position?: { x: number; y: number }) => void;
  clearEditor: () => void;
  arrangeNodes: () => void;
  exportData: () => any;
}

const ReteEditor = forwardRef<ReteEditorRef, ReteEditorProps>((
  { onNodeChange, onConnectionChange, onEditorChange, initialData, className },
  ref
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { editorData } = useNoCodeBuilder();
  const { setEditorData } = useNoCodeActions();
  const [nodes, setNodes] = useState<any[]>([]);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  // Handle drag and drop from palette
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/node-type');
    
    if (!nodeType || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newNode = {
      id: `node-${Date.now()}`,
      type: nodeType,
      label: nodeType.replace(/([A-Z])/g, ' $1').trim(),
      position: { x, y }
    };

    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    onNodeChange?.(updatedNodes);
    onEditorChange?.(updatedNodes);
    setDraggedNode(null);
  }, [nodes, onNodeChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/node-type');
    setDraggedNode(nodeType);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setDraggedNode(null);
    }
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    const updatedNodes = nodes.filter(node => node.id !== nodeId);
    setNodes(updatedNodes);
    onNodeChange?.(updatedNodes);
    onEditorChange?.(updatedNodes);
  }, [nodes, onNodeChange, onEditorChange]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    addNode: (type: string, position = { x: 100, y: 100 }) => {
      const newNode = {
        id: `node-${Date.now()}`,
        type,
        label: type.replace(/([A-Z])/g, ' $1').trim(),
        position
      };
      const updatedNodes = [...nodes, newNode];
      setNodes(updatedNodes);
      onNodeChange?.(updatedNodes);
      onEditorChange?.(updatedNodes);
    },
    clearEditor: () => {
      setNodes([]);
      onNodeChange?.([]);
      onEditorChange?.([]);
    },
    arrangeNodes: () => {
      // Simple auto-arrange: distribute nodes in a grid
      const arrangedNodes = nodes.map((node, index) => ({
        ...node,
        position: {
          x: (index % 3) * 250 + 50,
          y: Math.floor(index / 3) * 150 + 50
        }
      }));
      setNodes(arrangedNodes);
      onNodeChange?.(arrangedNodes);
      onEditorChange?.(arrangedNodes);
    },
    exportData: () => {
      return {
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type,
          label: node.label,
          position: node.position
        })),
        connections: [] // No connections in this simplified version
      };
    }
  }), [nodes, onNodeChange, onEditorChange]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full h-full bg-gray-50 relative overflow-hidden border-2 border-dashed border-gray-300", className)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      style={{ minHeight: '400px' }}
    >
      {/* Drop zone indicator */}
      {draggedNode && (
        <div className="absolute inset-0 bg-blue-50 bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-blue-300">
            <p className="text-blue-600 font-medium">Drop to add {draggedNode} node</p>
          </div>
        </div>
      )}

      {/* Placeholder text when empty */}
      {nodes.length === 0 && !draggedNode && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg font-medium mb-2">Visual Editor (Simplified)</p>
            <p className="text-sm">Drag and drop building blocks from the palette to start building</p>
          </div>
        </div>
      )}

      {/* Render nodes */}
      {nodes.map((node) => (
        <div
          key={node.id}
          className="absolute bg-white border border-gray-300 rounded-lg shadow-md p-4 min-w-[200px] cursor-move"
          style={{
            left: node.position.x,
            top: node.position.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-gray-800">{node.label}</div>
            <button
              onClick={() => removeNode(node.id)}
              className="text-red-500 hover:text-red-700 text-sm font-bold"
              title="Remove node"
            >
              ×
            </button>
          </div>
          <div className="text-xs text-gray-600">
            Type: {node.type}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ID: {node.id}
          </div>
        </div>
      ))}
    </div>
  );
});

ReteEditor.displayName = 'ReteEditor';

export default ReteEditor;