// src/components/core/Footer.tsx
import {Link} from '@/core/components/ui/link'
import { ExternalLink } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto py-8 text-center text-sm text-muted-foreground">
        <p>© {currentYear} Sparktype. All Rights Reserved (Placeholder).</p>
        <p className="mt-1">
          <Link 
            to="https://github.com/your-repo/signum-client" // Replace with your actual repo URL
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-primary transition-colors font-medium"
          >
            View on GitHub <ExternalLink className="inline-block ml-1 h-3 w-3" />
          </Link>
        </p>
        {/* You can add more links here, like Privacy Policy, Terms of Service, etc. */}
      </div>
    </footer>
  );
}