/**
 * LANDSCAPE ORIENTATION OVERLAY
 * 
 * This component displays a "rotate your device" message on mobile devices
 * when the phone is held in portrait mode.
 * 
 * TO REVERT/DISABLE:
 * 1. Remove the import and <LandscapeOverlay /> from App.tsx
 * 2. Or simply delete this file
 */

import { RotateCcw } from "lucide-react";

export function LandscapeOverlay() {
  return (
    <div 
      className="landscape-overlay"
      data-testid="landscape-overlay"
    >
      <div className="flex flex-col items-center justify-center gap-6 text-center p-8">
        <div className="animate-bounce">
          <RotateCcw className="w-20 h-20 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">
          Rotate Your Device
        </h2>
        <p className="text-gray-300 max-w-xs">
          Please turn your phone sideways to play Wisdom & Chance TCG
        </p>
        <div className="flex items-center gap-2 mt-4">
          <div className="w-8 h-12 border-2 border-purple-400 rounded-md opacity-50"></div>
          <span className="text-purple-400 text-2xl">→</span>
          <div className="w-12 h-8 border-2 border-purple-400 rounded-md bg-purple-400/20"></div>
        </div>
      </div>
    </div>
  );
}
