package main

import "time"

// SiteManifest represents the SparkType site manifest structure
type SiteManifest struct {
	SiteID           string           `json:"siteId"`
	GeneratorVersion string           `json:"generatorVersion"`
	Title            string           `json:"title"`
	Description      string           `json:"description"`
	Theme            ThemeConfig      `json:"theme"`
	Structure        []MenuItem       `json:"structure"`
	CollectionItems  []CollectionItem `json:"collectionItems"`
	Collections      []Collection     `json:"collections"`
}

// ThemeConfig represents the theme configuration
type ThemeConfig struct {
	Name   string                 `json:"name"`
	Config map[string]interface{} `json:"config"`
}

// MenuItem represents a navigation menu item (pages)
type MenuItem struct {
	Type     string     `json:"type"`
	Title    string     `json:"title"`
	Path     string     `json:"path"`
	Slug     string     `json:"slug"`
	NavOrder int        `json:"navOrder"`
	Children []MenuItem `json:"children"`
}

// CollectionItem represents an individual item in a collection
type CollectionItem struct {
	CollectionID string `json:"collectionId"`
	Slug         string `json:"slug"`
	Path         string `json:"path"`
	Title        string `json:"title"`
	URL          string `json:"url"`
}

// Collection represents a collection definition
type Collection struct {
	Name              string `json:"name"`
	ContentPath       string `json:"contentPath"`
	DefaultItemLayout string `json:"defaultItemLayout"`
	ID                string `json:"id"`
}

// LayoutConfig represents layout configuration in frontmatter
type LayoutConfig struct {
	CollectionID string `yaml:"collectionId"`
	Layout       string `yaml:"layout"`
}

// ContentFile represents a parsed markdown content file
type ContentFile struct {
	Title        string                 `json:"title"`
	Layout       string                 `json:"layout"`
	Date         time.Time              `json:"date"`
	Published    bool                   `json:"published"`
	Description  string                 `json:"description"`
	LayoutConfig *LayoutConfig          `json:"layoutConfig,omitempty"`
	Metadata     map[string]interface{} `json:"-"` // Additional frontmatter
	Content      string                 `json:"-"` // Markdown content
}

// NavigationItem represents an item in the UI navigation tree
type NavigationItem struct {
	Title        string
	Description  string
	Type         string // "page", "item"
	Path         string
	IsSelected   bool
	Level        int // For indentation
	ParentPath   string // For hierarchical navigation
	CollectionID string // For collection items
	Date         time.Time // For sorting
}

// AppState represents the different states of the application
type AppState int

const (
	StateMainMenu AppState = iota
	StateCollectionListing
	StateContentView
	StateLoading
	StateError
)