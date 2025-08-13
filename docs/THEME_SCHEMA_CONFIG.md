# Theme Schema and Configuration Documentation

## Overview

Sparktype themes define the visual appearance and behavior of sites through structured configuration schemas. Theme schemas provide user-configurable options for colors, typography, and custom content fields.

## Theme Architecture

### Theme Structure

```
public/themes/
├── theme-name/
│   ├── theme.json             # Theme configuration and schema
│   ├── base.hbs               # Base HTML template
│   ├── variables.css          # CSS variables and styles
│   └── partials/              # Reusable template components
│       ├── head.hbs
│       ├── header.hbs
│       └── footer.hbs
```

### Theme Manifest

The `theme.json` file defines theme metadata, configuration options, and user-customizable settings:

```json
{
  "name": "Default theme",
  "version": "1.2.0",
  "files": [
    { "path": "theme.json", "type": "manifest" },
    { "path": "base.hbs", "type": "base" },
    { "path": "variables.css", "type": "stylesheet" },
    { "path": "partials/head.hbs", "type": "partial", "name": "head" },
    { "path": "partials/header.hbs", "type": "partial", "name": "header" },
    { "path": "partials/footer.hbs", "type": "partial", "name": "footer" }
  ],
  "appearanceSchema": {
    // User-configurable appearance options
  },
  "themeDataSchema": {
    // Custom theme data fields
  },
  "image_presets": {
    // Image transformation presets
  }
}
```

## Appearance Schema

The `appearanceSchema` defines user-customizable visual options that appear in the site settings panel. It uses a flat structure with direct property names.

### Basic Color and Typography Configuration

```json
{
  "appearanceSchema": {
    "title": "Theme Customization",
    "description": "Customize the core fonts and colors of your site.",
    "type": "object",
    "properties": {
      "color_background": {
        "type": "string",
        "title": "Page Background Color",
        "format": "color",
        "default": "#f8f9fa"
      },
      "color_text": {
        "type": "string",
        "title": "Body Text Color",
        "format": "color",
        "default": "#212529"
      },
      "color_headings": {
        "type": "string",
        "title": "Headings Color",
        "format": "color",
        "default": "#000000"
      },
      "color_primary": {
        "type": "string",
        "title": "Primary Accent Color",
        "format": "color",
        "default": "#0d6efd"
      },
      "font_headings": {
        "type": "string",
        "title": "Heading style",
        "description": "Choose the font family for all headlines.",
        "enum": [
          "Geist",
          "Geist Mono",
          "Gentium Book Plus",
          "IBM Plex Mono",
          "IBM Plex Sans",
          "IBM Plex Serif",
          "Instrument Serif",
          "Inter"
        ],
        "default": "Inter"
      },
      "font_text": {
        "type": "string",
        "title": "Text style",
        "description": "Choose the font family for all paragraphs and lists.",
        "enum": [
          "Geist",
          "Geist Mono",
          "Gentium Book Plus",
          "IBM Plex Mono",
          "IBM Plex Sans",
          "IBM Plex Serif",
          "Instrument Serif",
          "Inter"
        ],
        "default": "Gentium Book Plus"
      }
    }
  }
}
```

### Extended Color Configuration (Documentation Theme Example)

Some themes may include additional color options:

```json
{
  "appearanceSchema": {
    "properties": {
      "color_border": {
        "type": "string",
        "title": "Border Color",
        "format": "color",
        "default": "#e5e5e5"
      },
      "color_sidebar": {
        "type": "string",
        "title": "Sidebar Background Color",
        "format": "color",
        "default": "#fff"
      },
      "sidebar_width": {
        "type": "string",
        "title": "Sidebar Width",
        "description": "Choose the width of the navigation sidebar.",
        "enum": ["240px", "280px", "320px"],
        "enumNames": ["Narrow (240px)", "Medium (280px)", "Wide (320px)"],
        "default": "280px"
      }
    }
  }
}
```

## Theme Data Schema

The `themeDataSchema` defines custom data fields that content creators can configure per-site for theme-specific content. These fields use a flat structure and are accessed in templates using the `themeData` helper.

### Basic Theme Data Configuration

```json
{
  "themeDataSchema": {
    "title": "Site Content",
    "description": "Configure additional content fields for your site.",
    "type": "object",
    "properties": {
      "footer_text": {
        "type": "string",
        "title": "Footer Text",
        "description": "HTML content to display in the site footer.",
        "format": "textarea",
        "default": "<p>&copy; 2024 Your Site Name. All rights reserved.</p>"
      },
      "header_announcement": {
        "type": "string", 
        "title": "Header Announcement",
        "description": "Optional announcement banner text.",
        "format": "textarea",
        "default": ""
      }
    }
  }
}
```

### Extended Theme Data (Documentation Theme Example)

```json
{
  "themeDataSchema": {
    "type": "object",
    "properties": {
      "header_content": {
        "type": "string",
        "title": "Header Content",
        "description": "Optional HTML content for the header bar",
        "format": "textarea",
        "default": ""
      },
      "footer_content": {
        "type": "string",
        "title": "Footer Content",
        "description": "Optional HTML content for the footer",
        "format": "textarea",
        "default": "© 2024 Documentation Site"
      }
    }
  }
}
```

## Image Presets

Image presets define transformation options for images used throughout the theme. These are specified at the root level of the theme manifest.

```json
{
  "image_presets": {
    "social": {
      "width": 1200,
      "height": 630,
      "crop": "fill",
      "gravity": "center",
      "description": "Social media sharing image (Open Graph)"
    },
    "thumbnail": {
      "width": 300,
      "height": 200,
      "crop": "fill",
      "gravity": "center",
      "description": "Small thumbnail for cards and previews"
    },
    "banner": {
      "width": 800,
      "height": 256,
      "crop": "fill",
      "gravity": "center",
      "description": "Standard banner image for headers"
    },
    "hero": {
      "width": 1200,
      "height": 600,
      "crop": "fill",
      "gravity": "center",
      "description": "Large hero image for landing pages"
    }
  }
}
```

## Template Implementation

### Base Template Structure

The `base.hbs` template provides the main HTML structure:

```handlebars
{{! themes/default/base.hbs }}
<!DOCTYPE html>
<html lang="en">
<head>
    {{> head headContext}}
</head>
<body>
    <div x-data="{ isMobileMenuOpen: false }" class="flex flex-col min-h-screen">
        {{> header}}
        <main class="flex-1">
            {{{body}}}
        </main>
        {{> footer}}
    </div>
    <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
</body>
</html>
```

### Theme Data Access in Templates

Theme data fields are accessed using the `themeData` helper:

```handlebars
{{! Access theme data fields }}
{{{themeData 'footer_text'}}}
{{{themeData 'header_announcement'}}}

{{! Conditional rendering based on theme data }}
{{#if (themeData 'header_announcement')}}
    <div class="announcement">
        {{{themeData 'header_announcement'}}}
    </div>
{{/if}}
```

### CSS Variable Integration

Theme configuration values are converted to CSS variables with this pattern:
- `color_background` becomes `--color-background`
- `font_headings` becomes `--font-headings`

The conversion replaces underscores with hyphens and prefixes with `--`.

### File Types

Valid file types in the `files` array:

- `"manifest"` - The theme.json file itself
- `"base"` - Main HTML template (base.hbs)
- `"stylesheet"` - CSS files
- `"partial"` - Handlebars partial templates

Partials must include a `name` property for registration.

## Working Example: Complete Theme Manifest

```json
{
  "name": "My Custom Theme",
  "version": "1.0.0",
  "files": [
    { "path": "theme.json", "type": "manifest" },
    { "path": "base.hbs", "type": "base" },
    { "path": "variables.css", "type": "stylesheet" },
    { "path": "partials/head.hbs", "type": "partial", "name": "head" },
    { "path": "partials/header.hbs", "type": "partial", "name": "header" },
    { "path": "partials/footer.hbs", "type": "partial", "name": "footer" }
  ],
  "appearanceSchema": {
    "title": "Theme Customization",
    "description": "Customize the colors and fonts of your site.",
    "type": "object",
    "properties": {
      "color_background": {
        "type": "string",
        "title": "Background Color",
        "format": "color",
        "default": "#ffffff"
      },
      "color_primary": {
        "type": "string",
        "title": "Primary Color",
        "format": "color",
        "default": "#3b82f6"
      },
      "font_headings": {
        "type": "string",
        "title": "Heading Font",
        "enum": ["Inter", "Georgia", "Arial"],
        "default": "Inter"
      }
    }
  },
  "themeDataSchema": {
    "title": "Site Content",
    "type": "object",
    "properties": {
      "footer_text": {
        "type": "string",
        "title": "Footer Text",
        "format": "textarea",
        "default": "<p>© 2024 My Site</p>"
      }
    }
  },
  "image_presets": {
    "thumbnail": {
      "width": 300,
      "height": 200,
      "crop": "fill",
      "gravity": "center"
    }
  }
}
```

This documentation reflects the current implementation and provides accurate information for theme developers.