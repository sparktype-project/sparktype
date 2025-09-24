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


  return (
    <svg className="rounded-lg m-auto" width={size} height={size} viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="1024" fill="black"/>
      <path d="M328.212 919L485.952 571.735L243 593.192L680.395 105L537.044 452.258L780 430.8L328.212 919Z" fill="url(#paint0_linear_1717_1427)"/>
      <defs>
      <linearGradient id="paint0_linear_1717_1427" x1="522.308" y1="916" x2="522.308" y2="140" gradientUnits="userSpaceOnUse">
      <stop offset="0.216346" stop-color="#FF00FF"/>
      <stop offset="0.504808" stop-color="hsla(61, 100%, 50%, 1.00)"/>
      <stop offset="0.764423" stop-color="#00FFFF"/>
      </linearGradient>
      </defs>
  </svg>
  );
}


