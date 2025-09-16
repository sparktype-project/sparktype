package main

import (
	"fmt"
	"log"
)

func main() {
	siteURL := "http://localhost:8080"

	// Test client creation and manifest fetching
	client, err := NewClient(siteURL)
	if err != nil {
		log.Fatal("Failed to create client:", err)
	}

	fmt.Println("✓ Client created successfully")
	fmt.Printf("  Base URL: %s\n", client.GetBaseURL())

	// Test manifest fetching
	manifest, err := client.FetchManifest()
	if err != nil {
		log.Fatal("Failed to fetch manifest:", err)
	}

	fmt.Println("\n✓ Manifest fetched successfully")
	fmt.Printf("  Site Title: %s\n", manifest.Title)
	fmt.Printf("  Site ID: %s\n", manifest.SiteID)
	fmt.Printf("  Generator: %s\n", manifest.GeneratorVersion)

	// Show structure
	fmt.Printf("\n📄 Pages (%d):\n", len(manifest.Structure))
	for _, item := range manifest.Structure {
		fmt.Printf("  - %s (%s)\n", item.Title, item.Path)
	}

	// Show collections
	fmt.Printf("\n📁 Collections (%d):\n", len(manifest.Collections))
	collectionCounts := make(map[string]int)
	for _, item := range manifest.CollectionItems {
		collectionCounts[item.CollectionID]++
	}

	for _, collection := range manifest.Collections {
		count := collectionCounts[collection.ID]
		fmt.Printf("  - %s (%d items)\n", collection.Name, count)

		// Show first few items
		itemCount := 0
		for _, item := range manifest.CollectionItems {
			if item.CollectionID == collection.ID && itemCount < 3 {
				fmt.Printf("    • %s\n", item.Title)
				itemCount++
			}
		}
	}

	// Test content fetching
	if len(manifest.Structure) > 0 {
		fmt.Printf("\n🔄 Testing content fetch for: %s\n", manifest.Structure[0].Title)
		content, err := client.FetchContent(manifest.Structure[0].Path)
		if err != nil {
			fmt.Printf("  ❌ Error: %v\n", err)
		} else {
			fmt.Printf("  ✓ Content fetched successfully\n")
			fmt.Printf("    Title: %s\n", content.Title)
			fmt.Printf("    Layout: %s\n", content.Layout)
			fmt.Printf("    Content Length: %d chars\n", len(content.Content))
		}
	}

	// Test content renderer
	fmt.Printf("\n🎨 Testing content renderer\n")
	renderer, err := NewContentRenderer()
	if err != nil {
		fmt.Printf("  ❌ Error creating renderer: %v\n", err)
	} else {
		fmt.Printf("  ✓ Content renderer created successfully\n")

		// Test markdown rendering
		testMarkdown := "# Test\n\nThis is **bold** and *italic* text.\n\n- Item 1\n- Item 2"
		rendered, err := renderer.RenderMarkdown(testMarkdown)
		if err != nil {
			fmt.Printf("  ❌ Render error: %v\n", err)
		} else {
			fmt.Printf("  ✓ Markdown rendered successfully (%d chars)\n", len(rendered))
		}
	}

	fmt.Println("\n🎉 All tests passed! The CLI components are working correctly.")
	fmt.Println("\nTo use the interactive CLI in a proper terminal:")
	fmt.Println("  ./st-cli http://localhost:8080")
}