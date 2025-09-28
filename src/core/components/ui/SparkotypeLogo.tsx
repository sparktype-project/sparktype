// src/core/components/ui/SparkotypeLogo.tsx

import { useEffect } from 'react';

interface SparktypeLogoProps {
  /** Size of the logo in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to enable color cycling (default: true) */
  animate?: boolean;
}


export default function SparkotypeLogo({
  size = 32,
  animate = true
}: SparktypeLogoProps) {

  useEffect(() => {
    if (!animate) return;

   

  }, [animate]);


  return (
    <svg className="rounded-lg m-auto" width={size} height={size} viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="1024" fill="black"/>
      <path d="M328.212 919L485.952 571.735L243 593.192L680.395 105L537.044 452.258L780 430.8L328.212 919Z" fill="url(#paint0_linear_1717_1427)"/>
      <defs>
      <linearGradient id="paint0_linear_1717_1427" x1="522.308" y1="916" x2="522.308" y2="140" gradientUnits="userSpaceOnUse">
      <stop offset="0.216346" stopColor="#FF00FF"/>
      <stop offset="0.504808" stopColor="hsla(61, 100%, 50%, 1.00)"/>
      <stop offset="0.764423" stopColor="#00FFFF"/>
      </linearGradient>
      </defs>
  </svg>
  );
}


