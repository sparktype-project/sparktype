// Test editor with SparkBlock engine creation to isolate crash
import React, { useState, useMemo } from 'react';
import { createSparkBlockEngine } from '../engine/SparkBlockEngine';
import type { SparkBlockAdapter } from '../types';

export interface EngineTestEditorProps {
  adapter: SparkBlockAdapter<string> | null;
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

/**
 * Test editor with engine creation - isolate if engine creation causes crash
 */
export function EngineTestEditor({
  adapter,
  initialContent = '',
  onContentChange
}: EngineTestEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [engineStatus, setEngineStatus] = useState<'none' | 'creating' | 'created' | 'error'>('none');

  // Try to create engine safely
  const engine = useMemo(() => {
    if (!adapter) {
      setEngineStatus('none');
      return null;
    }

    try {
      setEngineStatus('creating');
      const createdEngine = createSparkBlockEngine({
        adapter,
        plugins: [],
        readonly: false,
        autoSave: false,
        autoSaveDelay: 1000,
      });
      setEngineStatus('created');
      return createdEngine;
    } catch (error) {
      console.error('Engine creation failed:', error);
      setEngineStatus('error');
      return null;
    }
  }, [adapter]);

  const handleChange = (newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);
  };

  const getStatusColor = () => {
    switch (engineStatus) {
      case 'none': return '#666';
      case 'creating': return '#ff9500';
      case 'created': return '#00cc00';
      case 'error': return '#cc0000';
      default: return '#666';
    }
  };

  return (
    <div style={{ border: '2px solid purple', padding: '20px' }}>
      <h3>Engine Test Editor</h3>
      <div style={{ marginBottom: '10px' }}>
        <strong>Status:</strong> Testing engine creation
      </div>
      <div style={{ marginBottom: '10px', fontSize: '12px', color: getStatusColor() }}>
        Engine: {engineStatus} | Adapter: {adapter ? 'Available' : 'Missing'}
      </div>
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          width: '100%',
          height: '150px',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
        placeholder="Testing with engine creation..."
      />
      {engineStatus === 'error' && (
        <div style={{ marginTop: '10px', color: 'red', fontSize: '12px' }}>
          Engine creation failed - check console for details
        </div>
      )}
    </div>
  );
}