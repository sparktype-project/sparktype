# SparkType CLI Browser

A terminal-based browser for SparkType sites, inspired by gopher and gemini clients.

## Features

- **Navigation**: Browse SparkType sites with keyboard navigation
- **Collections**: View collections as organized groups with item counts
- **Content Rendering**: Beautiful terminal markdown rendering with Glamour
- **Responsive UI**: Clean interface built with Bubble Tea

## Usage

```bash
# Run the CLI with a site URL
./st-cli http://localhost:8080

# Or with any SparkType site
./st-cli https://yoursite.com
```

## Navigation

### Main Menu
- `↑/↓` or `j/k`: Navigate menu items
- `Enter` or `→` or `l`: Select item or enter collection
- `q`: Quit
- `r`: Refresh from server

### Collection View
- `↑/↓` or `j/k`: Navigate collection items
- `Enter` or `→` or `l`: View content
- `Esc` or `←` or `h` or `b`: Back to main menu
- `q`: Quit

### Content View
- `↑/↓` or `j/k`: Scroll content
- `Page Up/Down`: Page through content
- `Esc` or `←` or `h` or `b`: Back to menu
- `q`: Quit

## Architecture

The CLI discovers SparkType sites by fetching `/_site/manifest.json`, then builds a navigation tree from the manifest structure. Collections are displayed with item counts in the main menu, and selecting a collection shows a paginated list of its items.

Content is fetched on-demand and rendered using Glamour for beautiful terminal display with proper syntax highlighting and formatting.