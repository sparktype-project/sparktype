// src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import App from './App';
import './globals.css'; // Import global styles

// Error Boundary to catch any rendering errors at the very top level.
import ErrorBoundary from './core/components/ErrorBoundary'; 

// Providers
import { ThemeProvider } from './core/components/ThemeProvider';
import { EditorProvider } from './features/editor/contexts/EditorProvider';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// Find the root element from your index.html
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Fatal Error: Root element with id 'root' not found in the DOM.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* 
        The HashRouter is the outermost routing component. 
        It uses the URL hash for client-side routing.
      */}
      <HashRouter>
        {/*
          The ThemeProvider manages light/dark mode for the entire application.
          It's placed here to wrap all visible components.
        */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* 
            The EditorProvider manages the editor's save state and unsaved changes.
            Placing it here makes the editor context available to any route
            that needs it, like the editor pages and the header.
          */}
          <EditorProvider>
            <App />
          </EditorProvider>
        </ThemeProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);