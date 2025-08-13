# Layout Field Schema Documentation

## Overview

Layout field schemas define the structure and behavior of custom fields in Sparktype layouts. They use JSON Schema format with React JSON Schema Form (RJSF) extensions to create rich, interactive editing experiences.

## Schema Architecture

### Basic Structure

Every layout manifest contains two complementary schema definitions:

```json
{
  "name": "Layout Name",
  "layoutType": "single" | "collection",
  "schema": {
    // JSON Schema for data structure
  },
  "uiSchema": {
    // UI configuration for form rendering
  },
  "itemSchema": {
    // (Optional) Schema for collection items
  },
  "itemUiSchema": {
    // (Optional) UI schema for collection items
  }
}
```

### Schema vs. UI Schema

- **`schema`**: Defines data structure, validation, and types (JSON Schema standard)
- **`uiSchema`**: Defines form rendering, widgets, and UI behavior (RJSF extension)

## Core Field Types

### Text Fields

```json
{
  "schema": {
    "properties": {
      "title": {
        "type": "string",
        "title": "Article Title",
        "description": "The main heading for this content",
        "minLength": 1,
        "maxLength": 100
      },
      "subtitle": {
        "type": "string",
        "title": "Subtitle",
        "description": "Optional subheading"
      }
    },
    "required": ["title"]
  },
  "uiSchema": {
    "title": {
      "ui:placeholder": "Enter article title...",
      "ui:help": "Keep it concise and descriptive"
    },
    "subtitle": {
      "ui:widget": "textarea",
      "ui:options": {
        "rows": 2
      }
    }
  }
}
```

### Image Fields

```json
{
  "schema": {
    "properties": {
      "featured_image": {
        "type": "string",
        "title": "Featured Image",
        "description": "Main image for this content"
      },
      "gallery_images": {
        "type": "array",
        "title": "Image Gallery",
        "items": {
          "type": "string"
        }
      }
    }
  },
  "uiSchema": {
    "featured_image": {
      "ui:widget": "imageUploader"
    },
    "gallery_images": {
      "ui:widget": "imageUploader"
    }
  }
}
```

**Image Preset Integration**: Image fields automatically use smart conventions for preset selection. Override with `image_presets` when needed:

```json
{
  "image_presets": {
    "featured_image": "hero",
    "gallery_images": "gallery"
  }
}
```

### Rich Text Fields

```json
{
  "schema": {
    "properties": {
      "content": {
        "type": "string",
        "title": "Main Content",
        "description": "The body content with rich formatting"
      },
      "excerpt": {
        "type": "string",
        "title": "Excerpt",
        "description": "Brief summary or teaser"
      }
    }
  },
  "uiSchema": {
    "content": {
      "ui:widget": "richTextEditor",
      "ui:options": {
        "toolbar": ["bold", "italic", "link", "bulletList", "numberedList"],
        "placeholder": "Start writing your content..."
      }
    },
    "excerpt": {
      "ui:widget": "textarea",
      "ui:options": {
        "rows": 4,
        "maxLength": 300
      }
    }
  }
}
```

### Date and Time Fields

```json
{
  "schema": {
    "properties": {
      "event_date": {
        "type": "string",
        "format": "date",
        "title": "Event Date",
        "description": "When the event takes place"
      },
      "created_at": {
        "type": "string",
        "format": "date-time",
        "title": "Created At",
        "description": "Timestamp of creation"
      }
    }
  },
  "uiSchema": {
    "event_date": {
      "ui:widget": "date"
    },
    "created_at": {
      "ui:widget": "datetime",
      "ui:options": {
        "yearsRange": [2020, 2030]
      }
    }
  }
}
```

### Boolean Fields

```json
{
  "schema": {
    "properties": {
      "is_featured": {
        "type": "boolean",
        "title": "Featured Content",
        "description": "Mark as featured on homepage",
        "default": false
      },
      "allow_comments": {
        "type": "boolean",
        "title": "Allow Comments",
        "default": true
      }
    }
  },
  "uiSchema": {
    "is_featured": {
      "ui:widget": "switch"
    },
    "allow_comments": {
      "ui:widget": "checkbox"
    }
  }
}
```

### Select and Choice Fields

```json
{
  "schema": {
    "properties": {
      "category": {
        "type": "string",
        "title": "Category",
        "enum": ["technology", "design", "business", "lifestyle"],
        "enumNames": ["Technology", "Design", "Business", "Lifestyle"]
      },
      "priority": {
        "type": "string",
        "title": "Priority Level",
        "enum": ["low", "medium", "high"],
        "default": "medium"
      },
      "tags": {
        "type": "array",
        "title": "Tags",
        "items": {
          "type": "string",
          "enum": ["web", "mobile", "api", "frontend", "backend"]
        },
        "uniqueItems": true
      }
    }
  },
  "uiSchema": {
    "category": {
      "ui:widget": "select",
      "ui:placeholder": "Choose a category..."
    },
    "priority": {
      "ui:widget": "radio"
    },
    "tags": {
      "ui:widget": "checkboxes"
    }
  }
}
```

### Number Fields

```json
{
  "schema": {
    "properties": {
      "price": {
        "type": "number",
        "title": "Price",
        "description": "Product price in USD",
        "minimum": 0,
        "maximum": 10000
      },
      "quantity": {
        "type": "integer",
        "title": "Quantity",
        "minimum": 1,
        "default": 1
      },
      "rating": {
        "type": "number",
        "title": "Rating",
        "minimum": 1,
        "maximum": 5,
        "multipleOf": 0.5
      }
    }
  },
  "uiSchema": {
    "price": {
      "ui:widget": "updown",
      "ui:options": {
        "step": 0.01
      }
    },
    "quantity": {
      "ui:widget": "range",
      "ui:options": {
        "min": 1,
        "max": 100
      }
    },
    "rating": {
      "ui:widget": "range",
      "ui:options": {
        "step": 0.5
      }
    }
  }
}
```

### Array Fields

```json
{
  "schema": {
    "properties": {
      "features": {
        "type": "array",
        "title": "Key Features",
        "items": {
          "type": "string"
        },
        "minItems": 1,
        "maxItems": 10
      },
      "testimonials": {
        "type": "array",
        "title": "Customer Testimonials",
        "items": {
          "type": "object",
          "properties": {
            "quote": {
              "type": "string",
              "title": "Quote"
            },
            "author": {
              "type": "string",
              "title": "Author"
            },
            "company": {
              "type": "string",
              "title": "Company"
            }
          },
          "required": ["quote", "author"]
        }
      }
    }
  },
  "uiSchema": {
    "features": {
      "ui:options": {
        "addable": true,
        "removable": true,
        "orderable": true
      }
    },
    "testimonials": {
      "ui:options": {
        "addLabel": "Add Testimonial"
      },
      "items": {
        "quote": {
          "ui:widget": "textarea",
          "ui:options": {
            "rows": 3
          }
        }
      }
    }
  }
}
```

### Object Fields (Nested Structures)

```json
{
  "schema": {
    "properties": {
      "author_info": {
        "type": "object",
        "title": "Author Information",
        "properties": {
          "name": {
            "type": "string",
            "title": "Full Name"
          },
          "bio": {
            "type": "string",
            "title": "Biography"
          },
          "avatar": {
            "type": "string",
            "title": "Profile Photo"
          },
          "social_links": {
            "type": "object",
            "title": "Social Media",
            "properties": {
              "twitter": {
                "type": "string",
                "title": "Twitter Handle"
              },
              "linkedin": {
                "type": "string",
                "title": "LinkedIn URL"
              }
            }
          }
        },
        "required": ["name"]
      }
    }
  },
  "uiSchema": {
    "author_info": {
      "name": {
        "ui:autofocus": true
      },
      "bio": {
        "ui:widget": "textarea",
        "ui:options": {
          "rows": 4
        }
      },
      "avatar": {
        "ui:widget": "imageUploader"
      },
      "social_links": {
        "twitter": {
          "ui:placeholder": "@username"
        },
        "linkedin": {
          "ui:placeholder": "https://linkedin.com/in/username"
        }
      }
    }
  }
}
```

## Advanced Schema Features

### Conditional Fields

```json
{
  "schema": {
    "properties": {
      "content_type": {
        "type": "string",
        "title": "Content Type",
        "enum": ["article", "video", "podcast"],
        "default": "article"
      },
      "video_url": {
        "type": "string",
        "title": "Video URL"
      },
      "podcast_embed": {
        "type": "string",
        "title": "Podcast Embed Code"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": { "content_type": { "const": "video" } }
        },
        "then": {
          "required": ["video_url"]
        }
      },
      {
        "if": {
          "properties": { "content_type": { "const": "podcast" } }
        },
        "then": {
          "required": ["podcast_embed"]
        }
      }
    ]
  },
  "uiSchema": {
    "video_url": {
      "ui:widget": "conditionalField",
      "ui:options": {
        "condition": {
          "field": "content_type",
          "value": "video"
        }
      }
    },
    "podcast_embed": {
      "ui:widget": "conditionalField",
      "ui:options": {
        "condition": {
          "field": "content_type",
          "value": "podcast"
        }
      }
    }
  }
}
```

### Validation Rules

```json
{
  "schema": {
    "properties": {
      "email": {
        "type": "string",
        "title": "Email Address",
        "format": "email",
        "pattern": "^[^@]+@[^@]+\\.[^@]+$"
      },
      "website": {
        "type": "string",
        "title": "Website URL",
        "format": "uri",
        "pattern": "^https?://"
      },
      "slug": {
        "type": "string",
        "title": "URL Slug",
        "pattern": "^[a-z0-9-]+$",
        "minLength": 3,
        "maxLength": 50
      }
    }
  },
  "uiSchema": {
    "email": {
      "ui:help": "We'll use this for notifications",
      "ui:placeholder": "user@example.com"
    },
    "website": {
      "ui:placeholder": "https://example.com"
    },
    "slug": {
      "ui:help": "Lowercase letters, numbers, and hyphens only"
    }
  }
}
```

### Custom Field Grouping

```json
{
  "schema": {
    "properties": {
      "title": { "type": "string", "title": "Title" },
      "content": { "type": "string", "title": "Content" },
      "seo_title": { "type": "string", "title": "SEO Title" },
      "meta_description": { "type": "string", "title": "Meta Description" },
      "og_image": { "type": "string", "title": "Social Image" }
    }
  },
  "uiSchema": {
    "ui:groups": [
      {
        "title": "Content",
        "fields": ["title", "content"]
      },
      {
        "title": "SEO & Social",
        "fields": ["seo_title", "meta_description", "og_image"]
      }
    ],
    "content": {
      "ui:widget": "richTextEditor"
    },
    "meta_description": {
      "ui:widget": "textarea",
      "ui:options": { "rows": 3, "maxLength": 160 }
    },
    "og_image": {
      "ui:widget": "imageUploader"
    }
  }
}
```

## Layout Type Specific Schemas

### Single Layout Schema

For individual content pages:

```json
{
  "name": "Article Layout",
  "layoutType": "single",
  "schema": {
    "title": "Article Fields",
    "type": "object",
    "properties": {
      "subtitle": {
        "type": "string",
        "title": "Subtitle"
      },
      "reading_time": {
        "type": "integer",
        "title": "Reading Time (minutes)",
        "minimum": 1
      },
      "difficulty": {
        "type": "string",
        "title": "Difficulty Level",
        "enum": ["beginner", "intermediate", "advanced"]
      }
    }
  },
  "uiSchema": {
    "subtitle": {
      "ui:placeholder": "Optional subtitle..."
    },
    "difficulty": {
      "ui:widget": "select"
    }
  }
}
```

### Collection Layout Schemas

For layouts that display collections of content:

```json
{
  "name": "Blog Listing",
  "layoutType": "collection",
  "schema": {
    "title": "Blog Listing Configuration",
    "type": "object",
    "properties": {
      "intro_text": {
        "type": "string",
        "title": "Introduction Text",
        "description": "Text shown above the blog listing"
      },
      "posts_per_page": {
        "type": "integer",
        "title": "Posts Per Page",
        "minimum": 1,
        "maximum": 50,
        "default": 10
      }
    }
  },
  "itemSchema": {
    "title": "Blog Post Fields",
    "type": "object",
    "properties": {
      "excerpt": {
        "type": "string",
        "title": "Post Excerpt"
      },
      "read_more_text": {
        "type": "string",
        "title": "Read More Button Text",
        "default": "Read More"
      }
    }
  },
  "uiSchema": {
    "intro_text": {
      "ui:widget": "richTextEditor"
    }
  },
  "itemUiSchema": {
    "excerpt": {
      "ui:widget": "textarea",
      "ui:options": { "rows": 3 }
    }
  }
}
```

## Widget Reference

### Available Widgets

| Widget | Use Case | Configuration |
|--------|----------|---------------|
| `text` | Single-line text input | Default for string fields |
| `textarea` | Multi-line text input | `ui:options: { rows: 4 }` |
| `richTextEditor` | WYSIWYG content editing | `ui:options: { toolbar: [...] }` |
| `imageUploader` | Image file uploads | Works with image preset system |
| `select` | Dropdown selection | Use with `enum` values |
| `radio` | Radio button group | Use with `enum` values |
| `checkboxes` | Multiple checkbox selection | For array fields with `enum` |
| `checkbox` | Single checkbox | For boolean fields |
| `switch` | Toggle switch | For boolean fields |
| `date` | Date picker | Use with `format: "date"` |
| `datetime` | Date and time picker | Use with `format: "date-time"` |
| `updown` | Number input with arrows | For number fields |
| `range` | Slider input | For number fields with range |
| `hidden` | Hidden field | Not visible in UI |

### Widget Options

```json
{
  "uiSchema": {
    "field_name": {
      "ui:widget": "textarea",
      "ui:options": {
        "rows": 5,
        "placeholder": "Enter text here...",
        "help": "Additional help text",
        "disabled": false,
        "readonly": false
      },
      "ui:autofocus": true,
      "ui:description": "Field description",
      "ui:title": "Custom Field Title"
    }
  }
}
```

## Best Practices

### 1. Progressive Disclosure

Start with essential fields, use groups for advanced options:

```json
{
  "uiSchema": {
    "ui:groups": [
      {
        "title": "Basic Information",
        "fields": ["title", "content", "featured_image"]
      },
      {
        "title": "Advanced Options",
        "fields": ["seo_title", "meta_description", "custom_css"],
        "collapsible": true,
        "collapsed": true
      }
    ]
  }
}
```

### 2. Helpful Defaults and Placeholders

```json
{
  "schema": {
    "properties": {
      "status": {
        "type": "string",
        "enum": ["draft", "review", "published"],
        "default": "draft"
      }
    }
  },
  "uiSchema": {
    "title": {
      "ui:placeholder": "Enter a compelling title...",
      "ui:help": "Keep it under 60 characters for SEO"
    }
  }
}
```

### 3. Semantic Field Naming

Use descriptive, purpose-driven field names:

```json
{
  "schema": {
    "properties": {
      // Good: semantic, descriptive names
      "hero_image": { "type": "string", "title": "Hero Banner" },
      "author_bio": { "type": "string", "title": "Author Biography" },
      "publication_date": { "type": "string", "format": "date" },
      
      // Avoid: generic, unclear names
      "image1": { "type": "string" },
      "text_field": { "type": "string" },
      "date1": { "type": "string" }
    }
  }
}
```

### 4. Validation and Error Prevention

```json
{
  "schema": {
    "properties": {
      "email": {
        "type": "string",
        "format": "email",
        "title": "Contact Email"
      },
      "age": {
        "type": "integer",
        "minimum": 13,
        "maximum": 120,
        "title": "Age"
      }
    },
    "required": ["email"]
  },
  "uiSchema": {
    "email": {
      "ui:help": "We'll never share your email address"
    },
    "age": {
      "ui:help": "Must be 13 or older to register"
    }
  }
}
```

### 5. Performance Considerations

- Keep schemas focused and minimal
- Use conditional rendering for optional advanced fields
- Limit deep nesting in object structures
- Consider UX impact of too many fields

## Schema Inheritance

### Base Schema Integration

Layout schemas are merged with the base schema, which includes common fields:

```typescript
// Base schema provides these fields to all layouts:
{
  featured_image: string;
  banner_image: string;
  slug: string;
  menuTitle: string;
  date: string;
  published: boolean;
  author: string;
}
```

Your layout schema extends these base fields:

```json
{
  "schema": {
    "properties": {
      "custom_field": {
        "type": "string",
        "title": "Custom Field"
      }
    }
  }
}
```

**Result**: Users see both base fields AND custom fields in the editor.

### Override Behavior

Layout fields with the same name as base fields will override the base definition:

```json
{
  "schema": {
    "properties": {
      "author": {
        "type": "object",
        "title": "Author Details",
        "properties": {
          "name": { "type": "string" },
          "bio": { "type": "string" }
        }
      }
    }
  }
}
```

This overrides the base `author` string field with a more complex object structure.

## Migration and Versioning

### Schema Evolution

When updating schemas, consider backward compatibility:

```json
{
  "name": "Article Layout",
  "version": "2.0.0",
  "schema": {
    "properties": {
      // New field with default value for backward compatibility
      "article_type": {
        "type": "string",
        "enum": ["tutorial", "news", "opinion"],
        "default": "tutorial",
        "title": "Article Type"
      },
      // Existing field - unchanged
      "content": {
        "type": "string",
        "title": "Content"
      }
    }
  }
}
```

### Content Migration

When schema changes require data migration, document the process:

```markdown
## Migration from v1.0.0 to v2.0.0

1. All existing content gets `article_type: "tutorial"` by default
2. Review and update article types as needed
3. No data loss - all existing fields preserved
```

This comprehensive guide covers all aspects of layout field schemas in Sparktype, from basic field types to advanced patterns and best practices.