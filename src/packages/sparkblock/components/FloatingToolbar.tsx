// src/packages/sparkblock/components/FloatingToolbar.tsx

import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Link, Trash2, Copy } from 'lucide-react';
import { useSparkBlock } from './SparkBlockProvider';
import { useSparkBlockEngineStore } from '../engine/SparkBlockEngine';

/**
 * A toolbar that "floats" above the selected block(s).
 * It fetches the selectedBlockIds from the store and shows/hides itself automatically.
 */
export function FloatingToolbar() {
  const { engine } = useSparkBlock();
  const selectedBlockIds = useSparkBlockEngineStore(state => state.selectedBlockIds);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: -1000, left: -1000 });

  useEffect(() => {
    if (selectedBlockIds.length === 0) return;

    const updatePosition = () => {
      const blockElements = selectedBlockIds
        .map(id => document.querySelector(`[data-block-id="${id}"]`))
        .filter((el): el is Element => el != null);

      if (blockElements.length === 0) {
        setPosition({ top: -1000, left: -1000 }); // Hide if elements aren't found
        return;
      }

      const firstElementRect = blockElements[0].getBoundingClientRect();
      const toolbarHeight = toolbarRef.current?.offsetHeight || 40;
      
      setPosition({
        top: firstElementRect.top - toolbarHeight - 8,
        left: firstElementRect.left,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition, true);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition, true);
    };
  }, [selectedBlockIds]);

  const handleDelete = () => engine.executeCommand('delete-selected');
  const handleDuplicate = () => {
    selectedBlockIds.forEach(id => engine.duplicateBlock(id));
  };
  const handleFormat = (format: string) => console.log('Format:', format);

  if (selectedBlockIds.length === 0) {
    return null;
  }

  return (
    <div
      ref={toolbarRef}
      className="sparkblock-floating-toolbar"
      style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 1000 }}
    >
      {selectedBlockIds.length === 1 && (
        <div className="sparkblock-floating-toolbar-section">
          <button onClick={() => handleFormat('bold')} title="Bold"><Bold size={14} /></button>
          <button onClick={() => handleFormat('italic')} title="Italic"><Italic size={14} /></button>
          <button onClick={() => handleFormat('link')} title="Link"><Link size={14} /></button>
        </div>
      )}
      <div className="sparkblock-floating-toolbar-section">
        <button onClick={handleDuplicate} title="Duplicate"><Copy size={14} /></button>
        <button onClick={handleDelete} title="Delete"><Trash2 size={14} /></button>
      </div>
      <div className="sparkblock-floating-toolbar-info">
        {selectedBlockIds.length} selected
      </div>
    </div>
  );
}