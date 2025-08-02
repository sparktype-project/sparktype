// Slash command menu component

export interface SlashMenuProps {
  show: boolean;
  availableBlocks: any[];
  currentInput: string;
  onSelectBlock: (blockType: string) => void;
  inputRef?: React.RefObject<HTMLDivElement | null>;
}

export function SlashMenu({ show, availableBlocks, currentInput, onSelectBlock, inputRef }: SlashMenuProps) {
  if (!show) return null;

  const filteredBlocks = availableBlocks.filter(option => {
    const filter = currentInput.slice(1).toLowerCase();
    return !filter || 
      option.name.toLowerCase().includes(filter) || 
      option.description.toLowerCase().includes(filter) ||
      option.keywords.some((keyword: string) => keyword.toLowerCase().includes(filter));
  });

  // Calculate position based on input field if ref is provided
  let menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: '20px',
    bottom: '80px',
  };
  
  if (inputRef?.current) {
    const rect = inputRef.current.getBoundingClientRect();
    const menuWidth = 300; // min-w-[300px]
    const menuHeight = 300; // max-h-[300px]
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    // Calculate horizontal position
    let left = rect.left;
    if (left + menuWidth > viewport.width) {
      left = viewport.width - menuWidth - 10; // 10px margin from edge
    }
    if (left < 10) {
      left = 10; // 10px margin from left edge
    }
    
    // Calculate vertical position
    let top = rect.bottom + 5;
    if (top + menuHeight > viewport.height) {
      // Show above the input instead
      top = rect.top - menuHeight - 5;
    }
    if (top < 10) {
      top = 10; // 10px margin from top
    }
    
    menuStyle = {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
    };
  }

  return (
    <div 
      className="fixed bg-white border border-gray-300 rounded-lg shadow-lg min-w-[300px] max-h-[300px] overflow-auto z-[1000] md:max-w-[90vw]"
      style={menuStyle}
    >
      <div className="px-3 py-2 border-b border-gray-300 text-xs font-semibold text-gray-500">
        Block Types
      </div>
      {filteredBlocks.map(option => (
        <button
          key={option.id}
          onClick={() => onSelectBlock(option.fullId)}
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