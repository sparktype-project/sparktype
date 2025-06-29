// src/pages/MarketingHomePage.tsx

import { Link } from 'react-router-dom';

// UI Components (no changes needed)
import { Button } from '@/core/components/ui/button';
import { ShieldCheck, Feather, Zap, Archive, Leaf } from 'lucide-react';

// NO MORE 'react-helmet-async' import needed!

export default function MarketingHomePage() {
  return (
    <>
      {/*
        THIS IS THE NEW REACT 19 WAY.
        You can render <title> and <meta> tags directly in your component.
        React 19 will automatically move them to the document <head>.
      */}
      <title>Sparktype - Own Your Content</title>
      <meta name="description" content="A simple, private, and portable publishing platform that puts you back in control." />
      
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <Leaf className="h-7 w-7 text-primary" />
            <span className="text-2xl font-bold text-foreground hidden sm:inline">Sparktype</span>
          </Link>
          <Button asChild variant="ghost">
            <Link to="/sites">Dashboard</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 sm:py-24 text-center">
        <header className="mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
            Sparktype: Own Your Content.
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground">
            A simple, private, and portable publishing platform that puts you back in control.
          </p>
        </header>

        <div className="mb-16">
          <Button asChild size="lg">
            {/* The primary call-to-action now correctly links to the dashboard route. */}
            <Link to="/sites">
              Open Dashboard & Get Started
            </Link>
          </Button>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
          <div className="flex flex-col items-center p-6 bg-card border rounded-lg">
            <ShieldCheck className="size-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Private & Secure</h3>
            <p className="text-muted-foreground text-sm">
              No tracking or surveillance by default. Your data is yours.
            </p>
          </div>
          <div className="flex flex-col items-center p-6 bg-card border rounded-lg">
            <Feather className="size-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Simple & Focused</h3>
            <p className="text-muted-foreground text-sm">
              A minimal, content-first editor lets you focus on writing.
            </p>
          </div>
          <div className="flex flex-col items-center p-6 bg-card border rounded-lg">
            <Zap className="size-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Blazingly Fast</h3>
            <p className="text-muted-foreground text-sm">
              Static sites are fast, reliable, and efficient to host.
            </p>
          </div>
          <div className="flex flex-col items-center p-6 bg-card border rounded-lg">
            <Archive className="size-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Truly Portable</h3>
            <p className="text-muted-foreground text-sm">
              Export your entire site anytime. No vendor lock-in, ever.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}