import { Node } from '@tiptap/core';
import { NODE_NAMES } from '../constants';

export const Column = Node.create({
  name: NODE_NAMES.column,
  group: 'block',
  content: 'block+',
  isolating: true,

  parseHTML() {
    return [
      { tag: 'column' },
      { tag: 'div[data-column]' },
    ];
  },

  renderHTML() {
    return [
      'div',
      {
        'data-column': 'true',
        class: 'min-w-0 flex-1 rounded-md border border-dashed border-border/40 p-3',
      },
      0,
    ];
  },

  renderMarkdown(node, helpers) {
    const content = helpers.renderChildren(node.content || []);
    return `<column>\n${content}\n</column>`;
  },
});

export const ColumnGroup = Node.create({
  name: NODE_NAMES.columnGroup,
  group: 'block',
  content: `${NODE_NAMES.column}{2,}`,
  isolating: true,
  draggable: true,

  parseHTML() {
    return [
      { tag: 'column_group' },
      { tag: 'div[data-column-group]' },
    ];
  },

  renderHTML() {
    return [
      'div',
      {
        'data-column-group': 'true',
        class: 'my-4 grid gap-4 md:grid-cols-3',
      },
      0,
    ];
  },

  renderMarkdown(node, helpers) {
    const content = helpers.renderChildren(node.content || [], '\n');
    return `<column_group>\n${content}\n</column_group>`;
  },
});
