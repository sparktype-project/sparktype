package main

import (
	"bytes"
	"fmt"
	"regexp"
	"strings"

	"github.com/charmbracelet/glamour"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

// ContentRenderer handles rendering markdown content for terminal display
type ContentRenderer struct {
	glamour goldmark.Markdown
	term    *glamour.TermRenderer
}

// NewContentRenderer creates a new content renderer
func NewContentRenderer() (*ContentRenderer, error) {
	// Setup glamour for terminal rendering
	termRenderer, err := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(100),
	)
	if err != nil {
		return nil, err
	}

	// Setup goldmark for markdown parsing
	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
		goldmark.WithRendererOptions(
			html.WithHardWraps(),
		),
	)

	return &ContentRenderer{
		glamour: md,
		term:    termRenderer,
	}, nil
}

// RenderContent renders markdown content for terminal display
func (r *ContentRenderer) RenderContent(content *ContentFile) (string, error) {
	if content == nil {
		return "", nil
	}

	// Build full content with title and metadata
	var builder strings.Builder

	// Add title
	if content.Title != "" {
		builder.WriteString("# ")
		builder.WriteString(content.Title)
		builder.WriteString("\n\n")
	}

	// Add metadata if available
	if !content.Date.IsZero() {
		builder.WriteString("*Published: ")
		builder.WriteString(content.Date.Format("January 2, 2006"))
		builder.WriteString("*\n\n")
	}

	if content.Description != "" {
		builder.WriteString("*")
		builder.WriteString(content.Description)
		builder.WriteString("*\n\n")
	}

	// Add frontmatter images
	frontmatterImages := extractImageInfo(content.Metadata)
	for _, img := range frontmatterImages {
		builder.WriteString("📷 **[BANNER IMAGE]**")
		if img.AltText != "" {
			builder.WriteString(fmt.Sprintf(" %s", img.AltText))
		}
		if img.Width > 0 && img.Height > 0 {
			builder.WriteString(fmt.Sprintf(" (%dx%d)", img.Width, img.Height))
		}
		builder.WriteString(fmt.Sprintf("\n   *Source: %s*", img.URL))
		builder.WriteString("\n   *Images cannot be displayed in terminal*\n\n")
	}

	// Add horizontal rule before content
	if content.Title != "" || !content.Date.IsZero() || content.Description != "" || len(frontmatterImages) > 0 {
		builder.WriteString("---\n\n")
	}

	// Process content to handle images
	processedContent := r.processImages(content.Content)
	builder.WriteString(processedContent)

	// Render using glamour for terminal display
	rendered, err := r.term.Render(builder.String())
	if err != nil {
		// Fallback to plain text if glamour fails
		return builder.String(), nil
	}

	return rendered, nil
}

// RenderMarkdown renders plain markdown text using glamour
func (r *ContentRenderer) RenderMarkdown(markdown string) (string, error) {
	if r.term == nil {
		return markdown, nil
	}

	rendered, err := r.term.Render(markdown)
	if err != nil {
		return markdown, nil
	}

	return rendered, nil
}

// StripMarkdown removes markdown formatting and returns plain text
func (r *ContentRenderer) StripMarkdown(markdown string) string {
	var buf bytes.Buffer
	if err := r.glamour.Convert([]byte(markdown), &buf); err != nil {
		return markdown
	}

	// Basic HTML tag removal (simplified)
	text := buf.String()
	text = strings.ReplaceAll(text, "<p>", "")
	text = strings.ReplaceAll(text, "</p>", "\n")
	text = strings.ReplaceAll(text, "<br>", "\n")
	text = strings.ReplaceAll(text, "<br/>", "\n")

	// Remove other common HTML tags
	text = removeHTMLTags(text)

	return strings.TrimSpace(text)
}

// removeHTMLTags is a simple HTML tag remover
func removeHTMLTags(text string) string {
	var result strings.Builder
	inTag := false

	for _, char := range text {
		if char == '<' {
			inTag = true
		} else if char == '>' {
			inTag = false
		} else if !inTag {
			result.WriteRune(char)
		}
	}

	return result.String()
}

// processImages converts image markdown to terminal-friendly text representations
func (r *ContentRenderer) processImages(content string) string {
	// Regular expression to match markdown images: ![alt text](image_url "optional title")
	imageRegex := regexp.MustCompile(`!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]*)")?\)`)

	return imageRegex.ReplaceAllStringFunc(content, func(match string) string {
		submatches := imageRegex.FindStringSubmatch(match)
		if len(submatches) < 3 {
			return match // Return original if parsing fails
		}

		altText := submatches[1]
		imageURL := submatches[2]
		title := ""
		if len(submatches) > 3 && submatches[3] != "" {
			title = submatches[3]
		}

		// Create terminal representation
		var representation strings.Builder
		representation.WriteString("📷 **[IMAGE]**")

		if altText != "" {
			representation.WriteString(fmt.Sprintf(" %s", altText))
		}

		if title != "" && title != altText {
			representation.WriteString(fmt.Sprintf(" - %s", title))
		}

		// Add image path/URL info
		representation.WriteString(fmt.Sprintf("\n   *Source: %s*", imageURL))

		// Add helpful note
		representation.WriteString("\n   *Images cannot be displayed in terminal*")

		return representation.String()
	})
}

// ImageInfo represents extracted image metadata
type ImageInfo struct {
	AltText  string
	URL      string
	Title    string
	Width    int
	Height   int
}

// extractImageInfo extracts metadata from SparkType image frontmatter
func extractImageInfo(metadata map[string]interface{}) []ImageInfo {
	var images []ImageInfo

	// Check for banner_image
	if bannerImage, ok := metadata["banner_image"].(map[string]interface{}); ok {
		var info ImageInfo
		if alt, ok := bannerImage["alt"].(string); ok {
			info.AltText = alt
		}
		if src, ok := bannerImage["src"].(string); ok {
			info.URL = src
		}
		if width, ok := bannerImage["width"].(float64); ok {
			info.Width = int(width)
		}
		if height, ok := bannerImage["height"].(float64); ok {
			info.Height = int(height)
		}
		images = append(images, info)
	}

	return images
}