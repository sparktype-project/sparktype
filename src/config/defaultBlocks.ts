// src/config/defaultBlocks.ts

import { type BlockManifest } from '@/core/services/blockRegistry.service';

export const DEFAULT_BLOCKS: Record<string, BlockManifest> = {
  'core:paragraph': {
    id: 'core:paragraph',
    name: 'Text',
    category: 'Basic',
    description: 'Just start writing with plain text.',
    icon: 'Type',
    keywords: ['text', 'paragraph', 'p'],
    fields: {
      text: {
        type: 'text',
        label: 'Text',
        required: false,
        default: ''
      }
    },
    directive: {
      name: 'text',
      type: 'leaf',
      attributes: ['text']
    },
    behavior: {
      insertable: true,
      searchable: true,
      duplicatable: true,
      deletable: true,
      moveable: true,
      patterns: {
        autoFormat: true
      }
    },
    template: {
      handlebars: 'blocks/core/paragraph.hbs'
    }
  },

  'core:heading_1': {
    id: 'core:heading_1',
    name: 'Heading 1',
    category: 'Text',
    description: 'Big section heading.',
    icon: 'Heading1',
    keywords: ['heading', 'h1', 'title', 'big'],
    fields: {
      text: {
        type: 'text',
        label: 'Heading',
        required: false,
        default: ''
      }
    },
    directive: {
      name: 'h1',
      type: 'leaf',
      attributes: ['text']
    },
    behavior: {
      insertable: true,
      searchable: true,
      duplicatable: true,
      deletable: true,
      moveable: true,
      patterns: {
        trigger: '# ',
        autoFormat: true
      }
    },
    template: {
      handlebars: 'blocks/core/heading.hbs'
    }
  },

  'core:heading_2': {
    id: 'core:heading_2',
    name: 'Heading 2',
    category: 'Text',
    description: 'Medium section heading.',
    icon: 'Heading2',
    keywords: ['heading', 'h2', 'medium'],
    fields: {
      text: {
        type: 'text',
        label: 'Heading',
        required: false,
        default: ''
      }
    },
    directive: {
      name: 'h2',
      type: 'leaf',
      attributes: ['text']
    },
    behavior: {
      insertable: true,
      searchable: true,
      duplicatable: true,
      deletable: true,
      moveable: true,
      patterns: {
        trigger: '## ',
        autoFormat: true
      }
    },
    template: {
      handlebars: 'blocks/core/heading.hbs'
    }
  },

  'core:heading_3': {
    id: 'core:heading_3',
    name: 'Heading 3',
    category: 'Text',
    description: 'Small section heading.',
    icon: 'Heading3',
    keywords: ['heading', 'h3', 'small'],
    fields: {
      text: {
        type: 'text',
        label: 'Heading',
        required: false,
        default: ''
      }
    },
    directive: {
      name: 'h3',
      type: 'leaf',
      attributes: ['text']
    },
    behavior: {
      insertable: true,
      searchable: true,
      duplicatable: true,
      deletable: true,
      moveable: true,
      patterns: {
        trigger: '### ',
        autoFormat: true
      }
    },
    template: {
      handlebars: 'blocks/core/heading.hbs'
    }
  },

  'core:quote': {
    id: 'core:quote',
    name: 'Quote',
    category: 'Text',
    description: 'Capture a quote.',
    icon: 'Quote',
    keywords: ['quote', 'blockquote', 'citation'],
    fields: {
      text: {
        type: 'text',
        label: 'Quote',
        required: false,
        default: ''
      }
    },
    directive: {
      name: 'quote',
      type: 'leaf',
      attributes: ['text']
    },
    behavior: {
      insertable: true,
      searchable: true,
      duplicatable: true,
      deletable: true,
      moveable: true,
      patterns: {
        trigger: '> ',
        autoFormat: true
      }
    },
    template: {
      handlebars: 'blocks/core/quote.hbs'
    }
  },

  'core:code': {
    id: 'core:code',
    name: 'Code',
    category: 'Text',
    description: 'Capture a code snippet.',
    icon: 'Code',
    keywords: ['code', 'codeblock', 'programming', 'snippet'],
    fields: {
      code: {
        type: 'text',
        label: 'Code',
        required: false,
        default: ''
      },
      language: {
        type: 'text',
        label: 'Language',
        required: false,
        default: 'text'
      }
    },
    directive: {
      name: 'code',
      type: 'leaf',
      attributes: ['code', 'language']
    },
    behavior: {
      insertable: true,
      searchable: true,
      duplicatable: true,
      deletable: true,
      moveable: true,
      patterns: {
        trigger: '```',
        autoFormat: true
      }
    },
    template: {
      handlebars: 'blocks/core/code.hbs'
    }
  },

  'core:unordered_list': {
    id: 'core:unordered_list',
    name: 'Bulleted List',
    category: 'Text',
    description: 'Create a simple bulleted list.',
    icon: 'List',  
    keywords: ['bullet', 'list', 'unordered', 'ul'],
    fields: {
      text: {
        type: 'text',
        label: 'List Item',
        required: false,
        default: ''
      }
    },
    directive: {
      name: 'ul',
      type: 'leaf',
      attributes: ['text']
    },
    behavior: {
      insertable: true,
      searchable: true,
      duplicatable: true,
      deletable: true,
      moveable: true,
      patterns: {
        trigger: '- ',
        regex: '^[\\*\\-\\+] ',
        autoFormat: true
      }
    },
    template: {
      handlebars: 'blocks/core/list.hbs'
    }
  },

  'core:ordered_list': {
    id: 'core:ordered_list',
    name: 'Numbered List',
    category: 'Text',
    description: 'Create a list with numbering.',
    icon: 'ListOrdered',
    keywords: ['numbered', 'list', 'ordered', 'ol'],
    fields: {
      text: {
        type: 'text',
        label: 'List Item',
        required: false,
        default: ''
      }
    },
    directive: {
      name: 'ol',
      type: 'leaf',
      attributes: ['text']
    },
    behavior: {
      insertable: true,
      searchable: true,
      duplicatable: true,
      deletable: true,
      moveable: true,
      patterns: {
        trigger: '1. ',
        regex: '^\\d+\\. ',
        autoFormat: true
      }
    },
    template: {
      handlebars: 'blocks/core/list.hbs'
    }
  },

  'core:image': {
    id: 'core:image',
    name: 'Image',
    category: 'Media',
    description: 'Upload or embed with a link.',
    icon: 'Image',
    keywords: ['image', 'photo', 'picture', 'img'],
    fields: {
      src: {
        type: 'text',
        label: 'Image URL',
        required: true,
        default: ''
      },
      alt: {
        type: 'text',
        label: 'Alt Text',
        required: false,
        default: ''
      },
      width: {
        type: 'number',
        label: 'Width',
        required: false,
        default: 0
      },
      height: {
        type: 'number',
        label: 'Height',
        required: false,
        default: 0
      }
    },
    directive: {
      name: 'image',
      type: 'leaf',
      attributes: ['src', 'alt', 'width', 'height']
    },
    behavior: {
      insertable: true,
      searchable: true,
      duplicatable: true,
      deletable: true,
      moveable: true
    },
    template: {
      handlebars: 'blocks/core/image.hbs'
    }
  },

  'core:divider': {
    id: 'core:divider',
    name: 'Divider',
    category: 'Basic',
    description: 'Visually divide sections.',
    icon: 'Minus',
    keywords: ['divider', 'separator', 'hr', 'line'],
    fields: {},
    directive: {
      name: 'divider',
      type: 'leaf',
      attributes: []
    },
    behavior: {
      insertable: true,
      searchable: true,
      duplicatable: true,
      deletable: true,
      moveable: true,
      patterns: {
        trigger: '---',
        autoFormat: true
      }
    },
    template: {
      handlebars: 'blocks/core/divider.hbs'
    }
  },

  'core:container': {
    id: 'core:container',
    name: 'Container',
    category: 'Layout',
    description: 'A container to organize other blocks.',
    icon: 'Columns',
    keywords: ['container', 'layout', 'wrapper', 'section'],
    fields: {
      layout: {
        type: 'select',
        label: 'Layout',
        required: false,
        default: 'single',
        options: ['single', 'two-columns', 'three-columns', 'sidebar-left', 'sidebar-right']
      },
      gap: {
        type: 'select',
        label: 'Gap',
        required: false,
        default: 'medium',
        options: ['none', 'small', 'medium', 'large']
      }
    },
    regions: {
      main: {
        label: 'Main Content',
        allowedBlocks: [], // empty = all blocks allowed
        required: false
      },
      sidebar: {
        label: 'Sidebar',
        allowedBlocks: [],
        required: false
      }
    },
    directive: {
      name: 'container',
      type: 'container',
      attributes: ['layout', 'gap']
    },
    behavior: {
      insertable: true,
      searchable: true,
      duplicatable: true,
      deletable: true,
      moveable: true
    },
    template: {
      handlebars: 'blocks/core/container.hbs'
    }
  },

  'core:collection_view': {
    id: 'core:collection_view',
    name: 'Collection View',
    category: 'Layout',
    description: 'Display a dynamic list of content from a collection',
    icon: 'List',
    keywords: ['collection', 'list', 'posts', 'items', 'blog'],
    fields: {
      title: {
        type: 'text',
        label: 'Section Title',
        required: false,
        default: ''
      }
    },
    config: {
      collectionId: {
        type: 'select',
        label: 'Collection',
        required: true,
        default: ''
      },
      layout: {
        type: 'select',
        label: 'Layout Style',
        required: false,
        default: 'list',
        options: ['list', 'grid', 'cards']
      },
      maxItems: {
        type: 'number',
        label: 'Maximum Items',
        required: false,
        default: 10
      },
      sortBy: {
        type: 'select',
        label: 'Sort By',
        required: false,
        default: 'date',
        options: ['date', 'title', 'order']
      },
      sortOrder: {
        type: 'select',
        label: 'Sort Order',
        required: false,
        default: 'desc',
        options: ['desc', 'asc']
      }
    },
    directive: {
      name: 'collection_view',
      type: 'leaf',
      attributes: ['title', 'collectionId', 'layout', 'maxItems', 'sortBy', 'sortOrder']
    },
    behavior: {
      insertable: true,
      searchable: true,
      duplicatable: true,
      deletable: true,
      moveable: true
    },
    template: {
      handlebars: 'blocks/core/collection_view.hbs'
    }
  }
};