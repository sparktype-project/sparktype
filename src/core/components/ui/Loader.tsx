// src/core/components/ui/Loader.tsx

import { useEffect, useState } from 'react';
import { cn } from '@/core/libraries/utils';

interface LoaderProps {
  /** Additional CSS classes */
  className?: string;
  /** Size of the loader */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to show full screen overlay */
  fullScreen?: boolean;
  /** Optional loading text */
  text?: string;
}

const COLORS = ['#FFFF00', '#FF00FF', '#00FFFF']; // Yellow, Magenta, Cyan

const SIZE_CLASSES = {
  sm: 'size-16',
  md: 'size-24',
  lg: 'size-36',
  xl: 'size-48'
};

export default function Loader({
  className,
  size = 'lg',
  fullScreen = false,
  text
}: LoaderProps) {
  const [currentColor, setCurrentColor] = useState(COLORS[0]);

  // Randomly switch colors with random timing between 50-100ms
  useEffect(() => {
    const scheduleNextColorChange = () => {
      const randomDelay = Math.floor(Math.random() * 51) + 50; // 50-100ms
      setTimeout(() => {
        const randomIndex = Math.floor(Math.random() * COLORS.length);
        setCurrentColor(COLORS[randomIndex]);
        scheduleNextColorChange(); // Schedule the next change
      }, randomDelay);
    };

    scheduleNextColorChange();

    // No cleanup needed since we're not using setInterval
  }, []);

  const loaderContent = (
    <div className={cn(
      "flex flex-col items-center siz",
      className
    )}>
      <svg
        className={cn(SIZE_CLASSES[size], "transition-colors duration-300")}
        width="773"
        height="1007"
        viewBox="0 0 773 1007"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M122.661 1007L349.725 577.398L0 603.943L629.62 0L423.27 429.593L773 403.048L122.661 1007Z"
          fill={currentColor}
        />
      </svg>
      {text && (
        <p className="mt-4 text-sm text-muted-foreground animate-pulse">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center h-screen text-foreground">
        {loaderContent}
      </div>
    );
  }

  return loaderContent;
}