package main

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// App represents the main application state
type App struct {
	state              AppState
	siteURL            string
	client             *Client
	manifest           *SiteManifest
	navigationItems    []NavigationItem
	collectionItems    []CollectionItem
	collectionTitle    string
	currentPage        int
	totalPages         int
	itemsPerPage       int
	navigationHistory  [][]NavigationItem // Stack of navigation states for hierarchical navigation
	selectedIndex      int
	list               list.Model
	viewport           viewport.Model
	content            *ContentFile
	currentPath        string
	renderer           *ContentRenderer
	error              error
	ready              bool
	width              int
	height             int
}

// KeyMap defines the key bindings
type KeyMap struct {
	Up       key.Binding
	Down     key.Binding
	Enter    key.Binding
	Back     key.Binding
	Quit     key.Binding
	Refresh  key.Binding
	NextPage key.Binding
	PrevPage key.Binding
}

var keys = KeyMap{
	Up: key.NewBinding(
		key.WithKeys("up", "k"),
		key.WithHelp("↑/k", "up"),
	),
	Down: key.NewBinding(
		key.WithKeys("down", "j"),
		key.WithHelp("↓/j", "down"),
	),
	Enter: key.NewBinding(
		key.WithKeys("enter", "l"),
		key.WithHelp("enter/l", "select"),
	),
	Back: key.NewBinding(
		key.WithKeys("esc", "h", "b"),
		key.WithHelp("esc/h/b", "back"),
	),
	Quit: key.NewBinding(
		key.WithKeys("q", "ctrl+c"),
		key.WithHelp("q", "quit"),
	),
	Refresh: key.NewBinding(
		key.WithKeys("r"),
		key.WithHelp("r", "refresh"),
	),
	NextPage: key.NewBinding(
		key.WithKeys("right", "n"),
		key.WithHelp("→/n", "next page"),
	),
	PrevPage: key.NewBinding(
		key.WithKeys("left", "p"),
		key.WithHelp("←/p", "prev page"),
	),
}

// Styles
var (
	titleStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FAFAFA")).
			Background(lipgloss.Color("#7D56F4")).
			Padding(0, 1)

	statusStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#626262"))

	helpStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#626262"))
)

// NewApp creates a new application instance
func NewApp(siteURL string) *App {
	client, err := NewClient(siteURL)
	if err != nil {
		return &App{
			state:   StateError,
			siteURL: siteURL,
			error:   err,
		}
	}

	renderer, err := NewContentRenderer()
	if err != nil {
		return &App{
			state:   StateError,
			siteURL: siteURL,
			error:   err,
		}
	}

	return &App{
		state:        StateLoading,
		siteURL:      siteURL,
		client:       client,
		renderer:     renderer,
		itemsPerPage: 10,
		currentPage:  1,
	}
}

// Messages for async operations
type ManifestLoadedMsg struct {
	manifest *SiteManifest
	err      error
}

type ContentLoadedMsg struct {
	content *ContentFile
	err     error
}

// Init initializes the application
func (a *App) Init() tea.Cmd {
	return a.loadManifest
}

// loadManifest fetches the site manifest
func (a *App) loadManifest() tea.Msg {
	manifest, err := a.client.FetchManifest()
	return ManifestLoadedMsg{manifest: manifest, err: err}
}

// loadContent fetches content for a given path
func (a *App) loadContent(path string) tea.Cmd {
	return func() tea.Msg {
		content, err := a.client.FetchContent(path)
		return ContentLoadedMsg{content: content, err: err}
	}
}

// Update handles messages and updates the application state
func (a *App) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		a.setupUI()
		return a, nil

	case ManifestLoadedMsg:
		if msg.err != nil {
			a.state = StateError
			a.error = msg.err
			return a, nil
		}
		a.manifest = msg.manifest
		a.buildNavigationItems()
		a.state = StateMainMenu
		a.setupUI()
		return a, nil

	case ContentLoadedMsg:
		if msg.err != nil {
			a.state = StateError
			a.error = msg.err
			return a, nil
		}
		a.content = msg.content

		// Check if this is a collection listing page
		if a.content.LayoutConfig != nil && a.content.LayoutConfig.CollectionID != "" {
			// This page has a collection - show collection listing
			a.showCollectionListing(a.content.LayoutConfig.CollectionID, a.content.Title)
			a.state = StateCollectionListing
			a.setupCollectionListingUI()
		} else {
			// Regular content page - show content view
			a.state = StateContentView
			a.setupContentView()
		}
		return a, nil

	case tea.KeyMsg:
		return a.handleKeyPress(msg)
	}

	var cmd tea.Cmd
	switch a.state {
	case StateMainMenu:
		a.list, cmd = a.list.Update(msg)
	case StateContentView:
		a.viewport, cmd = a.viewport.Update(msg)
	}

	return a, cmd
}

// handleKeyPress handles keyboard input
func (a *App) handleKeyPress(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch {
	case key.Matches(msg, keys.Quit):
		return a, tea.Quit

	case key.Matches(msg, keys.Back):
		return a.handleBack()

	case key.Matches(msg, keys.Enter):
		return a.handleEnter()

	case key.Matches(msg, keys.Refresh):
		return a.handleRefresh()
	}

	// Handle number key navigation and pagination
	switch a.state {
	case StateMainMenu:
		// Check for number key navigation
		if msg.String() >= "1" && msg.String() <= "9" {
			num := int(msg.String()[0] - '1') // Convert to 0-based index
			if num < len(a.navigationItems) {
				return a.selectNavigationItem(num)
			}
		}
	case StateCollectionListing:
		// Check for number key navigation
		if msg.String() >= "1" && msg.String() <= "9" {
			num := int(msg.String()[0] - '1') // Convert to 0-based index
			pageItems := a.getCurrentPageItems()
			if num < len(pageItems) {
				return a.selectCollectionItem(pageItems[num])
			}
		}
		// Handle pagination
		if key.Matches(msg, keys.NextPage) && a.currentPage < a.totalPages {
			a.currentPage++
			a.setupCollectionListingUI()
			return a, nil
		}
		if key.Matches(msg, keys.PrevPage) && a.currentPage > 1 {
			a.currentPage--
			a.setupCollectionListingUI()
			return a, nil
		}
	}

	// Let the focused component handle other keys (including up/down for list navigation)
	var cmd tea.Cmd
	switch a.state {
	case StateMainMenu, StateCollectionListing:
		a.list, cmd = a.list.Update(msg)
	case StateContentView:
		a.viewport, cmd = a.viewport.Update(msg)
	}

	return a, cmd
}

// handleBack handles the back navigation
func (a *App) handleBack() (tea.Model, tea.Cmd) {
	switch a.state {
	case StateContentView:
		a.state = StateMainMenu
		a.setupUI()
	case StateCollectionListing:
		a.state = StateMainMenu
		a.setupUI()
	case StateMainMenu:
		return a, tea.Quit
	}
	return a, nil
}

// handleEnter handles the enter key selection
func (a *App) handleEnter() (tea.Model, tea.Cmd) {
	switch a.state {
	case StateMainMenu:
		selectedItem := a.list.SelectedItem()
		if _, ok := selectedItem.(NavigationItemWrapper); ok {
			return a.selectNavigationItem(a.list.Index())
		}
	case StateCollectionListing:
		selectedItem := a.list.SelectedItem()
		if item, ok := selectedItem.(CollectionItemWrapper); ok {
			return a.selectCollectionItem(item.CollectionItem)
		}
	}

	return a, nil
}

// selectNavigationItem handles navigation item selection
func (a *App) selectNavigationItem(index int) (tea.Model, tea.Cmd) {
	if index >= len(a.navigationItems) {
		return a, nil
	}

	navItem := a.navigationItems[index]
	a.currentPath = navItem.Path
	a.state = StateLoading
	return a, a.loadContent(navItem.Path)
}

// selectCollectionItem handles collection item selection
func (a *App) selectCollectionItem(item CollectionItem) (tea.Model, tea.Cmd) {
	a.currentPath = item.Path
	a.state = StateLoading
	return a, a.loadContent(item.Path)
}

// handleRefresh refreshes the current view
func (a *App) handleRefresh() (tea.Model, tea.Cmd) {
	switch a.state {
	case StateMainMenu, StateCollectionListing:
		a.state = StateLoading
		return a, a.loadManifest
	case StateContentView:
		if a.currentPath != "" {
			a.state = StateLoading
			return a, a.loadContent(a.currentPath)
		}
	}
	return a, nil
}

// setupUI initializes the UI components
func (a *App) setupUI() {
	if a.width == 0 || a.height == 0 {
		return
	}

	// Setup list component with numbered items
	items := make([]list.Item, len(a.navigationItems))
	for i, navItem := range a.navigationItems {
		// Add number prefix to title
		numberedTitle := fmt.Sprintf("%d. %s", i+1, navItem.Title)
		navItemCopy := navItem
		navItemCopy.Title = numberedTitle
		items[i] = NavigationItemWrapper{NavigationItem: navItemCopy}
	}

	delegate := list.NewDefaultDelegate()
	delegate.Styles.SelectedTitle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("#7D56F4")).
		Bold(true)

	a.list = list.New(items, delegate, a.width, a.height-4)
	a.list.Title = a.getTitle()
	a.list.SetShowStatusBar(false)
	a.list.SetShowHelp(false)

	a.ready = true
}

// setupContentView initializes the content viewport
func (a *App) setupContentView() {
	if a.content == nil {
		return
	}

	// Render markdown content using glamour
	var content string
	if a.renderer != nil {
		rendered, err := a.renderer.RenderContent(a.content)
		if err != nil {
			// Fallback to simple formatting
			content = fmt.Sprintf("# %s\n\n%s", a.content.Title, a.content.Content)
		} else {
			content = rendered
		}
	} else {
		content = fmt.Sprintf("# %s\n\n%s", a.content.Title, a.content.Content)
	}

	a.viewport = viewport.New(a.width, a.height-4)
	a.viewport.SetContent(content)
}

// getTitle returns the appropriate title for the current state
func (a *App) getTitle() string {
	if a.manifest == nil {
		return "SparkType CLI"
	}

	switch a.state {
	case StateMainMenu:
		return a.renderSiteTitle()
	case StateCollectionListing:
		return a.collectionTitle
	case StateContentView:
		if a.content != nil {
			return fmt.Sprintf("%s - %s", a.manifest.Title, a.content.Title)
		}
	}

	return a.manifest.Title
}

// renderSiteTitle renders the site title with ASCII art styling
func (a *App) renderSiteTitle() string {
	if a.manifest == nil {
		return "SparkType CLI"
	}

	title := a.manifest.Title
	// Simple ASCII art-style border
	border := strings.Repeat("═", len(title)+4)

	titleBlock := fmt.Sprintf("╔%s╗\n║  %s  ║\n╚%s╝", border, title, border)

	// Add site description if available
	if a.manifest.Description != "" {
		titleBlock += fmt.Sprintf("\n\n%s", a.manifest.Description)
	}

	return titleBlock
}

// showCollectionListing shows collection items in a dedicated listing view
func (a *App) showCollectionListing(collectionID, title string) {
	if a.manifest == nil {
		return
	}

	// Get items for this collection
	var items []CollectionItem
	for _, item := range a.manifest.CollectionItems {
		if item.CollectionID == collectionID {
			items = append(items, item)
		}
	}

	// Sort by date (most recent first)
	a.sortCollectionItemsByDate(items)

	a.collectionItems = items
	a.collectionTitle = title
	a.currentPage = 1
	a.totalPages = (len(items) + a.itemsPerPage - 1) / a.itemsPerPage
}

// getCurrentPageItems returns the items for the current page
func (a *App) getCurrentPageItems() []CollectionItem {
	start := (a.currentPage - 1) * a.itemsPerPage
	end := start + a.itemsPerPage
	if end > len(a.collectionItems) {
		end = len(a.collectionItems)
	}
	return a.collectionItems[start:end]
}

// setupCollectionListingUI initializes the collection listing UI
func (a *App) setupCollectionListingUI() {
	if a.width == 0 || a.height == 0 {
		return
	}

	pageItems := a.getCurrentPageItems()
	items := make([]list.Item, len(pageItems))

	// Fetch metadata for all items on this page
	a.fetchCollectionItemsMetadata(pageItems, func(itemsWithMetadata []CollectionItemWrapper) {
		for i, itemWithMetadata := range itemsWithMetadata {
			items[i] = itemWithMetadata
		}

		delegate := list.NewDefaultDelegate()
		delegate.Styles.SelectedTitle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#7D56F4")).
			Bold(true)

		a.list = list.New(items, delegate, a.width, a.height-4)
		a.list.Title = a.getTitle()
		a.list.SetShowStatusBar(false)
		a.list.SetShowHelp(false)

		a.ready = true
	})
}

// fetchCollectionItemsMetadata fetches date and description for collection items
func (a *App) fetchCollectionItemsMetadata(items []CollectionItem, callback func([]CollectionItemWrapper)) {
	itemsWithMetadata := make([]CollectionItemWrapper, len(items))

	// For now, we'll fetch synchronously for simplicity
	// In a real implementation, this could be done asynchronously
	for i, item := range items {
		// Add number prefix to title
		numberedTitle := fmt.Sprintf("%d. %s", i+1, item.Title)

		// Fetch content to get date and description
		content, err := a.client.FetchContent(item.Path)

		var dateStr, description string
		if err == nil {
			if !content.Date.IsZero() {
				dateStr = content.Date.Format("2 January 2006")
			}
			description = content.Description
		} else {
			// Fallback if content can't be fetched
			dateStr = "Date unavailable"
			description = ""
		}

		itemsWithMetadata[i] = CollectionItemWrapper{
			CollectionItem: CollectionItem{
				CollectionID: item.CollectionID,
				Slug:         item.Slug,
				Path:         item.Path,
				Title:        numberedTitle,
				URL:          item.URL,
			},
			ItemDate:        dateStr,
			ItemDescription: description,
		}
	}

	callback(itemsWithMetadata)
}

// View renders the application
func (a *App) View() string {
	if !a.ready && a.state != StateError {
		return "Loading..."
	}

	switch a.state {
	case StateError:
		return fmt.Sprintf("Error: %v\n\nPress 'q' to quit.", a.error)

	case StateLoading:
		return "Loading..."

	case StateMainMenu:
		help := helpStyle.Render("↑/↓: navigate • 1-9: select by number • enter: select • q: quit • r: refresh")
		return fmt.Sprintf("%s\n%s", a.list.View(), help)

	case StateCollectionListing:
		help := helpStyle.Render("↑/↓: navigate • 1-9: select by number • ←/→: prev/next page • esc: back • q: quit")
		if a.totalPages > 1 {
			pageInfo := fmt.Sprintf("Page %d of %d", a.currentPage, a.totalPages)
			help = fmt.Sprintf("%s | %s", help, pageInfo)
		}
		return fmt.Sprintf("%s\n%s", a.list.View(), help)

	case StateContentView:
		help := helpStyle.Render("↑/↓: scroll • esc: back • q: quit")
		title := titleStyle.Render(a.getTitle())
		return fmt.Sprintf("%s\n%s\n%s", title, a.viewport.View(), help)
	}

	return "Unknown state"
}