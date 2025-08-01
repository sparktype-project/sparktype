// src/packages/sparkblock/components/blocks/DefaultBlockRenderers.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash-es';
import type { SparkBlock, RenderContext } from '../../types';

export interface BlockComponentProps {
  block: SparkBlock;
  context: RenderContext;
}

// --- Block Components (Corrected and Fully Implemented) ---

export function ParagraphBlock({ block, context }: BlockComponentProps) {
  const [text, setText] = useState((block.content.text as string) || '');

  const debouncedOnChange = useCallback(
    debounce((newText: string) => {
      context.onChange?.({ ...block.content, text: newText });
    }, 400),
    [context.onChange, block.content]
  );

  useEffect(() => {
    const newText = (block.content.text as string) || '';
    if (newText !== text) setText(newText);
  }, [block.content.text]);

  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    const newText = event.currentTarget.textContent || '';
    setText(newText);
    debouncedOnChange(newText);
  };

  return (
    <div
      contentEditable={!context.readonly}
      suppressContentEditableWarning
      className="outline-none min-h-6 whitespace-pre-wrap"
      onInput={handleInput}
      onKeyDown={context.onKeyDown}
      onFocus={context.onFocus}
      data-placeholder="Type something..."
    >{text}</div>
  );
}

export function HeadingBlock({ block, context }: BlockComponentProps) {
  const level = (block.content.level as number) || 1;
  const [text, setText] = useState((block.content.text as string) || '');

  const debouncedOnChange = useCallback(
    debounce((newText: string) => {
      context.onChange?.({ ...block.content, text: newText });
    }, 400),
    [context.onChange, block.content]
  );

  useEffect(() => {
    const newText = (block.content.text as string) || '';
    if (newText !== text) setText(newText);
  }, [block.content.text]);

  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    const newText = event.currentTarget.textContent || '';
    setText(newText);
    debouncedOnChange(newText);
  };

  const headingProps = {
    contentEditable: !context.readonly,
    suppressContentEditableWarning: true,
    className: `outline-none font-bold m-0 min-h-5 ${level === 1 ? 'text-3xl leading-tight' : level === 2 ? 'text-2xl leading-snug' : level === 3 ? 'text-xl leading-normal' : level === 4 ? 'text-lg leading-normal' : level === 5 ? 'text-base leading-relaxed' : 'text-sm leading-relaxed'}`,
    onInput: handleInput,
    onKeyDown: context.onKeyDown,
    onFocus: context.onFocus,
    'data-placeholder': `Heading ${level}`,
    children: text
  };

  switch (level) {
    case 1: return <h1 {...headingProps} />;
    case 2: return <h2 {...headingProps} />;
    case 3: return <h3 {...headingProps} />;
    case 4: return <h4 {...headingProps} />;
    case 5: return <h5 {...headingProps} />;
    case 6: return <h6 {...headingProps} />;
    default: return <h1 {...headingProps} />;
  }
}

export function QuoteBlock({ block, context }: BlockComponentProps) {
  const [text, setText] = useState((block.content.text as string) || '');

  const debouncedOnChange = useCallback(
    debounce((newText: string) => {
      context.onChange?.({ ...block.content, text: newText });
    }, 400),
    [context.onChange, block.content]
  );
  
  useEffect(() => {
    const newText = (block.content.text as string) || '';
    if (newText !== text) setText(newText);
  }, [block.content.text]);

  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    const newText = event.currentTarget.textContent || '';
    setText(newText);
    debouncedOnChange(newText);
  };

  return (
    <blockquote className="m-0 pl-4 border-l-4 border-gray-300 italic">
      <div
        contentEditable={!context.readonly}
        suppressContentEditableWarning
        className="outline-none min-h-6"
        onInput={handleInput}
        onKeyDown={context.onKeyDown}
        onFocus={context.onFocus}
        data-placeholder="Enter quote..."
      >{text}</div>
      {(block.content.author as string) && (
        <cite className="block mt-2 text-sm text-gray-500 not-italic">— {String(block.content.author)}</cite>
      )}
    </blockquote>
  );
}

export function CodeBlock({ block, context }: BlockComponentProps) {
  const [code, setCode] = useState((block.content.code as string) || '');

  const debouncedOnChange = useCallback(
    debounce((newCode: string) => {
      context.onChange?.({ ...block.content, code: newCode });
    }, 400),
    [context.onChange, block.content]
  );

  useEffect(() => {
    const newCode = (block.content.code as string) || '';
    if (newCode !== code) setCode(newCode);
  }, [block.content.code]);

  const handleInput = (event: React.FormEvent<HTMLPreElement>) => {
    const newCode = event.currentTarget.textContent || '';
    setCode(newCode);
    debouncedOnChange(newCode);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLPreElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
    context.onKeyDown?.(event);
  };

  return (
    <div className="bg-gray-100 rounded-md overflow-hidden">
      {(block.content.language as string) && (
        <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-200 border-b border-gray-300">{String(block.content.language)}</div>
      )}
      <pre
        contentEditable={!context.readonly}
        suppressContentEditableWarning
        className="outline-none p-3 m-0 font-mono text-sm leading-normal whitespace-pre-wrap overflow-x-auto bg-transparent"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={context.onFocus}
        data-placeholder="Enter code..."
      >{code}</pre>
    </div>
  );
}

export function ListBlock({ block, context }: BlockComponentProps) {
  const isOrdered = block.content.ordered as boolean;
  const [text, setText] = useState((block.content.text as string) || '');

  const debouncedOnChange = useCallback(
    debounce((newText: string) => {
      context.onChange?.({ ...block.content, text: newText });
    }, 400),
    [context.onChange, block.content]
  );

  useEffect(() => {
    const newText = (block.content.text as string) || '';
    if (newText !== text) setText(newText);
  }, [block.content.text]);

  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    const newText = event.currentTarget.textContent || '';
    setText(newText);
    debouncedOnChange(newText);
  };

  return (
    <div className="flex items-start gap-2">
      <div className="text-gray-500 font-medium mt-0.5 min-w-4">{isOrdered ? '1.' : '•'}</div>
      <div
        contentEditable={!context.readonly}
        suppressContentEditableWarning
        className="flex-1 outline-none min-h-6"
        onInput={handleInput}
        onKeyDown={context.onKeyDown}
        onFocus={context.onFocus}
        data-placeholder="List item..."
      >{text}</div>
    </div>
  );
}

export function ImageBlock({ block, context }: BlockComponentProps) {
  const [caption, setCaption] = useState((block.content.caption as string) || '');

  const debouncedOnChange = useCallback(
    debounce((newCaption: string) => {
      context.onChange?.({ ...block.content, caption: newCaption });
    }, 400),
    [context.onChange, block.content]
  );

  useEffect(() => {
    const newCaption = (block.content.caption as string) || '';
    if (newCaption !== caption) setCaption(newCaption);
  }, [block.content.caption]);

  const handleCaptionInput = (event: React.FormEvent<HTMLDivElement>) => {
    const newCaption = event.currentTarget.textContent || '';
    setCaption(newCaption);
    debouncedOnChange(newCaption);
  };

  if (!block.content.src) {
    return (
      <div className="text-center">
        <div className="p-10 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
          <div className="text-base cursor-pointer">📷 Click to add image</div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <img src={block.content.src as string} alt={(block.content.alt as string) || ''} className="max-w-full h-auto rounded-md shadow-sm"/>
      {(caption || !context.readonly) && (
        <div
          contentEditable={!context.readonly}
          suppressContentEditableWarning
          className="mt-2 text-sm text-gray-500 italic outline-none"
          onInput={handleCaptionInput}
          data-placeholder="Add a caption..."
        >{caption}</div>
      )}
    </div>
  );
}

export function DividerBlock(): React.JSX.Element {
  return (
    <div className="my-4">
      <hr className="border-none h-px bg-gray-300 m-0" />
    </div>
  );
}


export function ContainerBlock({ block }: BlockComponentProps) {
  const layout = (block.content.layout as string) || 'single';
  const gap = (block.content.gap as string) || 'medium';

  return (
    <div className="border border-gray-300 rounded-md p-4 my-2 bg-gray-50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">📦</span>
        <span className="font-semibold text-gray-700">Container</span>
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">
          <span>Layout: {layout}</span>
          <span> • Gap: {gap}</span>
        </div>
        <div className="text-xs text-gray-500">
          {block.regions && Object.keys(block.regions).length > 0 ? (
            <div>Regions: {Object.keys(block.regions).join(', ')}</div>
          ) : (
            <div className="text-gray-400 italic">No content regions</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function UnknownBlock({ block }: BlockComponentProps) {
  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">Unknown block: {block.type}</span>
      </div>
      <pre className="font-mono text-xs max-h-[200px] overflow-auto bg-white bg-opacity-50 p-2 rounded">
        {JSON.stringify(block.content, null, 2)}
      </pre>
    </div>
  );
}

export const DefaultBlockRenderers: Record<string, React.ComponentType<BlockComponentProps>> = {
  paragraph: ParagraphBlock,
  heading: HeadingBlock,
  heading_1: props => <HeadingBlock {...props} block={{...props.block, content: {...props.block.content, level: 1}}} />,
  heading_2: props => <HeadingBlock {...props} block={{...props.block, content: {...props.block.content, level: 2}}} />,
  heading_3: props => <HeadingBlock {...props} block={{...props.block, content: {...props.block.content, level: 3}}} />,
  quote: QuoteBlock,
  code: CodeBlock,
  list: ListBlock,
  unordered_list: props => <ListBlock {...props} block={{...props.block, content: {...props.block.content, ordered: false}}} />,
  ordered_list: props => <ListBlock {...props} block={{...props.block, content: {...props.block.content, ordered: true}}} />,
  image: ImageBlock,
  divider: DividerBlock,
  container: ContainerBlock,
  unknown: UnknownBlock,
};