

import { ColumnItemPlugin, ColumnPlugin } from '@platejs/layout/react';

import { ColumnElement, ColumnGroupElement } from '@/components/ui/column-node';

export const ColumnKit = [
  ColumnPlugin.configure({
    render: {
      node: ColumnGroupElement,
    },
    parsers: {
      html: {
        deserializer: {
          isElement: true,
          parse: ({ element }) => {
            console.log('ColumnKit: Parsing COLUMN_GROUP element:', element);
            console.log('ColumnKit: Element innerHTML:', element.innerHTML);
            return { type: 'column_group' };
          },
          rules: [
            {
              validNodeName: 'COLUMN_GROUP',
            },
          ],
        },
      },
    },
  }),
  ColumnItemPlugin.configure({
    render: {
      node: ColumnElement,
    },
    parsers: {
      html: {
        deserializer: {
          isElement: true,
          parse: ({ element }) => {
            console.log('ColumnKit: Parsing COLUMN element:', element);
            console.log('ColumnKit: Element innerHTML:', element.innerHTML);
            return {
              type: 'column',
              width: element.getAttribute('width') || undefined
            };
          },
          rules: [
            {
              validNodeName: 'COLUMN',
            },
          ],
        },
      },
    },
  }),
];
