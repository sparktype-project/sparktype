import { afterEach, describe, expect, test } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Column, ColumnGroup } from '../extensions/Columns';
import { CollectionView } from '../extensions/CollectionView';
import { MediaEmbed } from '../extensions/MediaEmbed';
import { SparktypeImage } from '../extensions/SparktypeImage';
import { SparktypeVideo } from '../extensions/SparktypeVideo';
import { NODE_NAMES } from '../constants';

const editors: Editor[] = [];

function createEditor(markdown = '') {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: false,
        underline: false,
      }),
      Markdown,
      Underline,
      Link,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table,
      TableRow,
      TableCell,
      TableHeader,
      SparktypeImage.configure({ siteId: 'site-1' }),
      SparktypeVideo,
      MediaEmbed,
      CollectionView.configure({
        collections: [{ id: 'posts', name: 'Posts' }],
      }),
      Column,
      ColumnGroup,
    ],
    content: markdown,
    contentType: 'markdown',
  });

  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
});

describe('TipTap markdown persistence', () => {
  test('round-trips standard markdown blocks and marks', () => {
    const source = '# Heading\n\nParagraph with **bold**, _italic_, and a [link](https://example.com).\n';
    const editor = createEditor(source);

    expect(editor.getMarkdown()).toContain('# Heading');
    expect(editor.getMarkdown()).toContain('**bold**');
    expect(editor.getMarkdown()).toContain('[link](https://example.com)');
  });

  test('serializes local images back to source asset paths even when the editor uses a blob preview URL', () => {
    const editor = createEditor();

    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: NODE_NAMES.image,
          attrs: {
            src: 'blob:preview-image',
            alt: 'Hero',
            title: null,
            imageRef: {
              serviceId: 'local',
              src: 'assets/images/hero.jpg',
              alt: 'Hero',
            },
          },
        },
      ],
    });

    expect(editor.getMarkdown().trim()).toBe('![Hero](assets/images/hero.jpg)');
  });

  test('preserves uploaded video metadata attributes across parse and serialize', () => {
    const source = '<video src="https://cdn.example.com/demo.mp4" controls preload="metadata" data-sparktype-upload="true" data-sparktype-service-id="cloudinary" data-sparktype-video-src="videos/demo" data-sparktype-poster="https://cdn.example.com/demo.jpg" data-sparktype-width="1920" data-sparktype-height="1080" data-sparktype-duration="42" data-sparktype-provider-publicId="videos/demo"></video>';
    const editor = createEditor(source);
    const markdown = editor.getMarkdown();

    expect(markdown).toContain('data-sparktype-upload="true"');
    expect(markdown).toContain('data-sparktype-service-id="cloudinary"');
    expect(markdown).toContain('data-sparktype-video-src="videos/demo"');
    expect(markdown).toContain('data-sparktype-provider-publicId="videos/demo"');
  });

  test('accepts legacy collection container syntax and serializes the canonical single-line directive', () => {
    const source = ':::collection_view{collection="posts" layout="grid-view" maxItems="6"}\n:::\n';
    const editor = createEditor(source);

    expect(editor.getMarkdown()).toBe('::collection_view{collection="posts" layout="grid-view" maxItems="6" sortBy="date" sortOrder="desc"}');
  });

  test('round-trips legacy column blocks', () => {
    const source = '<column_group>\n<column>\nParagraph one\n</column>\n<column>\nParagraph two\n</column>\n</column_group>';
    const editor = createEditor(source);
    const markdown = editor.getMarkdown();

    expect(markdown).toContain('<column_group>');
    expect(markdown).toContain('<column>');
    expect(markdown).toContain('Paragraph one');
    expect(markdown).toContain('Paragraph two');
  });

  test('keeps GFM tables and task lists serializable', () => {
    const source = '- [x] Ship migration\n- [ ] Add e2e coverage\n\n| Name | Value |\n| --- | --- |\n| TipTap | 3 |\n';
    const editor = createEditor(source);
    const markdown = editor.getMarkdown();

    expect(markdown).toContain('- [x] Ship migration');
    expect(markdown).toMatch(/\|\s*Name\s*\|\s*Value\s*\|/);
    expect(markdown).toMatch(/\|\s*TipTap\s*\|\s*3\s*\|/);
  });
});
