// src/core/components/header-content/MarketingHeaderContent.tsx

import { Link } from 'react-router-dom';
import { Button } from '@/core/components/ui/button';

export default function MarketingHeaderContent() {
  return (
    <Button
      asChild
      variant="ghost"
      onMouseDown={(e) => e.stopPropagation()} // Prevent dragging on button
    >
      <Link to="/sites">Dashboard</Link>
    </Button>
  );
}