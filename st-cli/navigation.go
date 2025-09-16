package main

import (
	"fmt"
)

// NavigationItemWrapper wraps NavigationItem for the list component
type NavigationItemWrapper struct {
	NavigationItem
}

// Title returns the title for the list item
func (n NavigationItemWrapper) Title() string {
	// Get the item number (1-based index from the current list)
	// This will be handled by the caller when setting up the list
	return n.NavigationItem.Title
}

// Description returns the description for the list item
func (n NavigationItemWrapper) Description() string {
	return n.NavigationItem.Description
}

// FilterValue returns the value to filter on
func (n NavigationItemWrapper) FilterValue() string {
	return n.NavigationItem.Title
}

// CollectionItemWrapper wraps CollectionItem for the list component
type CollectionItemWrapper struct {
	CollectionItem
	ItemDate        string
	ItemDescription string
}

// Title returns the title for the collection item
func (c CollectionItemWrapper) Title() string {
	return c.CollectionItem.Title
}

// Description returns the description for the collection item
func (c CollectionItemWrapper) Description() string {
	if c.ItemDate != "" && c.ItemDescription != "" {
		return fmt.Sprintf("%s\n%s", c.ItemDate, c.ItemDescription)
	} else if c.ItemDate != "" {
		return c.ItemDate
	} else if c.ItemDescription != "" {
		return c.ItemDescription
	}
	return ""
}

// FilterValue returns the value to filter on
func (c CollectionItemWrapper) FilterValue() string {
	return c.CollectionItem.Title
}

// buildNavigationItems creates the navigation tree from the manifest
func (a *App) buildNavigationItems() {
	if a.manifest == nil {
		return
	}

	var items []NavigationItem

	// Add regular pages from structure
	for _, menuItem := range a.manifest.Structure {
		items = append(items, NavigationItem{
			Title: menuItem.Title,
			Type:  "page",
			Path:  menuItem.Path,
			Level: 0,
		})
	}

	a.navigationItems = items
}

// showCollectionItems shows collection items under a parent page
func (a *App) showCollectionItems(parentPath, collectionID string) {
	if a.manifest == nil {
		return
	}

	// Get items for this collection and sort by date (most recent first)
	var collectionItems []CollectionItem
	for _, item := range a.manifest.CollectionItems {
		if item.CollectionID == collectionID {
			collectionItems = append(collectionItems, item)
		}
	}

	// Sort by date - we'll need to fetch dates from content files
	a.sortCollectionItemsByDate(collectionItems)

	// Build new navigation items including collection items under parent
	var items []NavigationItem

	// Add all current top-level items
	for _, navItem := range a.navigationItems {
		items = append(items, navItem)

		// If this is the parent page, add collection items under it
		if navItem.Path == parentPath {
			for _, collectionItem := range collectionItems {
				items = append(items, NavigationItem{
					Title:        collectionItem.Title,
					Type:         "item",
					Path:         collectionItem.Path,
					Level:        1, // Indented under parent
					ParentPath:   parentPath,
					CollectionID: collectionItem.CollectionID,
				})
			}
		}
	}

	a.navigationItems = items
}

// sortCollectionItemsByDate sorts collection items by date (most recent first)
func (a *App) sortCollectionItemsByDate(items []CollectionItem) {
	// Sort items by fetching their dates
	// This is a simplified implementation - in practice you might want to cache dates
	for i := 0; i < len(items); i++ {
		for j := i + 1; j < len(items); j++ {
			// Fetch dates for comparison
			content1, err1 := a.client.FetchContent(items[i].Path)
			content2, err2 := a.client.FetchContent(items[j].Path)

			// Compare dates (most recent first)
			if err1 == nil && err2 == nil {
				if content1.Date.Before(content2.Date) {
					// Swap items
					items[i], items[j] = items[j], items[i]
				}
			}
		}
	}
}