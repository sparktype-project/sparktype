// src/core/components/ui/SparkotypeLogo.tsx

import { useEffect, useState } from 'react';
import { cn } from '@/core/libraries/utils';

interface SparktypeLogoProps {
  /** Size of the logo in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to enable color cycling (default: true) */
  animate?: boolean;
}

// CMY and intermediate colors for smooth cycling
const COLOR_CYCLE = [
  '#FFFF00', // Yellow
  '#FF8000', // Yellow-Red intermediate
  '#FF0000', // Red (intermediate between Yellow and Magenta)
  '#FF0080', // Red-Magenta intermediate
  '#FF00FF', // Magenta
  '#8000FF', // Magenta-Blue intermediate
  '#0000FF', // Blue (intermediate between Magenta and Cyan)
  '#0080FF', // Blue-Cyan intermediate
  '#00FFFF', // Cyan
  '#00FF80', // Cyan-Green intermediate
  '#00FF00', // Green (intermediate between Cyan and Magenta)
  '#80FF00', // Green-Yellow intermediate
  
];

export default function SparkotypeLogo({
  size = 32,
  className,
  animate = true
}: SparktypeLogoProps) {
  const [currentColorIndex, setCurrentColorIndex] = useState(0);

  useEffect(() => {
    if (!animate) return;

    const interval = setInterval(() => {
      setCurrentColorIndex((prevIndex) => (prevIndex + 1) % COLOR_CYCLE.length);
    }, 10000); // 10 seconds between color changes

    return () => clearInterval(interval);
  }, [animate]);

  const currentColor = animate ? COLOR_CYCLE[currentColorIndex] : '#FFFF00';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('rounded-lg', className)}
    >
      <rect width="1024" height="1024" fill="black" />
      <path
        d="M299.152 919L482.697 571.735L200 593.192L708.948 105L542.147 452.258L824.848 430.8L299.152 919Z"
        fill={currentColor}
        style={{
          transition: animate ? 'fill 2s ease-in-out' : undefined
        }}
      />
    </svg>
  );
}