// src/features/editor/blocks/TestBlock.tsx

import { createReactBlockSpec } from '@blocknote/react';
import { defaultProps } from '@blocknote/core';

/**
 * Simple test block to debug the isInGroup error
 */
export const TestBlock = createReactBlockSpec(
  {
    type: "testBlock",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
    },
    content: "inline",
  },
  {
    render: (props) => (
      <div style={{ border: '2px solid blue', padding: '10px', margin: '5px' }}>
        <h3>Test Block</h3>
        <p>This is a simple test block.</p>
        <div ref={props.contentRef} />
      </div>
    ),
  }
);