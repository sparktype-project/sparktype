package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Client handles HTTP requests to SparkType sites
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new SparkType site client
func NewClient(siteURL string) (*Client, error) {
	// Parse and validate URL
	u, err := url.Parse(siteURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %v", err)
	}

	// Ensure we have a proper base URL
	baseURL := fmt.Sprintf("%s://%s", u.Scheme, u.Host)
	if u.Path != "" && u.Path != "/" {
		baseURL += strings.TrimSuffix(u.Path, "/")
	}

	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// FetchManifest retrieves and parses the site manifest
func (c *Client) FetchManifest() (*SiteManifest, error) {
	// Try common manifest locations
	manifestPaths := []string{
		"/_site/manifest.json",
		"/manifest.json",
	}

	var lastErr error
	for _, manifestPath := range manifestPaths {
		manifestURL := c.baseURL + manifestPath

		resp, err := c.httpClient.Get(manifestURL)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			lastErr = err
			continue
		}

		var manifest SiteManifest
		if err := json.Unmarshal(body, &manifest); err != nil {
			lastErr = err
			continue
		}

		return &manifest, nil
	}

	return nil, fmt.Errorf("could not fetch manifest: %v", lastErr)
}

// FetchContent retrieves and parses a content file
func (c *Client) FetchContent(contentPath string) (*ContentFile, error) {
	// Build full URL for content
	contentURL := c.baseURL
	if strings.HasPrefix(contentPath, "/_site/") {
		contentURL += contentPath
	} else {
		contentURL += "/_site/" + strings.TrimPrefix(contentPath, "/")
	}

	resp, err := c.httpClient.Get(contentURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch content: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read content: %v", err)
	}

	return c.parseMarkdown(string(body))
}

// parseMarkdown parses a markdown file with YAML frontmatter
func (c *Client) parseMarkdown(content string) (*ContentFile, error) {
	// Split frontmatter and content
	parts := strings.SplitN(content, "---", 3)
	if len(parts) < 3 {
		return nil, fmt.Errorf("invalid markdown format: missing frontmatter")
	}

	frontmatter := strings.TrimSpace(parts[1])
	markdownContent := strings.TrimSpace(parts[2])

	// Parse frontmatter
	var metadata map[string]interface{}
	if err := yaml.Unmarshal([]byte(frontmatter), &metadata); err != nil {
		return nil, fmt.Errorf("failed to parse frontmatter: %v", err)
	}

	contentFile := &ContentFile{
		Content:  markdownContent,
		Metadata: metadata,
	}

	// Extract common fields
	if title, ok := metadata["title"].(string); ok {
		contentFile.Title = title
	}
	if layout, ok := metadata["layout"].(string); ok {
		contentFile.Layout = layout
	}
	if description, ok := metadata["description"].(string); ok {
		contentFile.Description = description
	}
	if published, ok := metadata["published"].(bool); ok {
		contentFile.Published = published
	}

	// Parse date
	if dateStr, ok := metadata["date"].(string); ok {
		if date, err := time.Parse("2006-01-02", dateStr); err == nil {
			contentFile.Date = date
		}
	}

	// Parse layout config
	if layoutConfigRaw, ok := metadata["layoutConfig"]; ok {
		layoutConfigBytes, err := yaml.Marshal(layoutConfigRaw)
		if err == nil {
			var layoutConfig LayoutConfig
			if err := yaml.Unmarshal(layoutConfigBytes, &layoutConfig); err == nil {
				contentFile.LayoutConfig = &layoutConfig
			}
		}
	}

	return contentFile, nil
}

// GetBaseURL returns the base URL of the site
func (c *Client) GetBaseURL() string {
	return c.baseURL
}