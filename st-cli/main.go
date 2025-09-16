package main

import (
	"fmt"
	"log"
	"os"

	tea "github.com/charmbracelet/bubbletea"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: st-cli <site-url>")
		os.Exit(1)
	}

	siteURL := os.Args[1]

	// Initialize the application with the site URL
	app := NewApp(siteURL)

	// Start the Bubble Tea program
	p := tea.NewProgram(app, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		log.Fatal(err)
	}
}