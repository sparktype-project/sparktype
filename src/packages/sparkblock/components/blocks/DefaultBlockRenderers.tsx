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
      className="sparkblock-paragraph"
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
    className: `sparkblock-heading sparkblock-heading--${level}`,
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
    <blockquote className="sparkblock-quote">
      <div
        contentEditable={!context.readonly}
        suppressContentEditableWarning
        className="sparkblock-quote-text"
        onInput={handleInput}
        onKeyDown={context.onKeyDown}
        onFocus={context.onFocus}
        data-placeholder="Enter quote..."
      >{text}</div>
      {(block.content.author as string) && (
        <cite className="sparkblock-quote-author">— {String(block.content.author)}</cite>
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
    <div className="sparkblock-code-block">
      {(block.content.language as string) && (
        <div className="sparkblock-code-language">{String(block.content.language)}</div>
      )}
      <pre
        contentEditable={!context.readonly}
        suppressContentEditableWarning
        className="sparkblock-code"
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
    <div className={`sparkblock-list ${isOrdered ? 'sparkblock-list--ordered' : ''}`}>
      <div className="sparkblock-list-marker">{isOrdered ? '1.' : '•'}</div>
      <div
        contentEditable={!context.readonly}
        suppressContentEditableWarning
        className="sparkblock-list-content"
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
      <div className="sparkblock-image sparkblock-image--empty">
        <div className="sparkblock-image-placeholder">📷 Click to add image</div>
      </div>
    );
  }

  return (
    <div className="sparkblock-image">
      <img src={block.content.src as string} alt={(block.content.alt as string) || ''} className="sparkblock-image-element"/>
      {(caption || !context.readonly) && (
        <div
          contentEditable={!context.readonly}
          suppressContentEditableWarning
          className="sparkblock-image-caption"
          onInput={handleCaptionInput}
          data-placeholder="Add a caption..."
        >{caption}</div>
      )}
    </div>
  );
}

export function DividerBlock(): React.JSX.Element {
  return (
    <div className="sparkblock-divider"><hr /></div>
  );
}

export function UnknownBlock({ block }: BlockComponentProps) {
  return (
    <div className="sparkblock-unknown">
      <div className="sparkblock-unknown-header">
        <span className="sparkblock-unknown-type">Unknown block: {block.type}</span>
      </div>
      <pre className="sparkblock-unknown-content">
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
  unknown: UnknownBlock,
};