// Block menu component for creating and converting blocks

export interface BlockMenuProps {
  show: { type: 'create' | 'convert', blockId?: string, position?: { x: number, y: number } } | null;
  availableBlocks: any[];
  onSelectBlock: (blockType: string, action: 'create' | 'convert', blockId?: string) => void;
  onClose: () => void;
}

export function BlockMenu({ show, availableBlocks, onSelectBlock, onClose }: BlockMenuProps) {
  if (!show) return null;

  // Calculate viewport-aware position
  const menuWidth = 250; // min-w-[250px]
  const menuHeight = 300; // max-h-[300px]
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  
  let left = show.position?.x || 0;
  let top = show.position?.y || 0;
  
  // Adjust horizontal position if menu would go off screen
  if (left + menuWidth > viewport.width) {
    left = viewport.width - menuWidth - 10;
  }
  if (left < 10) {
    left = 10;
  }
  
  // Adjust vertical position if menu would go off screen
  if (top + menuHeight > viewport.height) {
    top = viewport.height - menuHeight - 10;
  }
  if (top < 10) {
    top = 10;
  }

  return (
    <div 
      className="fixed bg-white border border-gray-300 rounded-lg shadow-lg min-w-[250px] max-h-[300px] overflow-auto z-[1000] md:max-w-[90vw]" 
      onClick={(e) => e.stopPropagation()}
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      <div className="px-3 py-2 border-b border-gray-300 text-xs font-semibold text-gray-500">
        {show.type === 'create' ? 'Add Block Below' : 'Convert Block Type'}
      </div>
      {availableBlocks.map(option => (
        <button
          key={option.id}
          onClick={() => {
            onSelectBlock(option.fullId, show.type, show.blockId);
            onClose();
          }}
          className="flex items-center gap-3 px-4 py-3 bg-transparent border-none w-full text-left cursor-pointer transition-colors duration-200 hover:bg-gray-100"
        >
          <span className="text-base w-5 text-center flex-shrink-0 text-gray-500">{option.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900">{option.name}</div>
            <div className="text-xs text-gray-500">{option.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}