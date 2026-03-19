"use client";

import { RefObject } from "react";
import { LearningState } from "@/hooks/useEmotionDetection";

const STATE_CONFIG: Record<
  LearningState,
  { label: string; color: string; glow: string; icon: string }
> = {
  engaged: {
    label: "Engaged",
    color: "text-green-400",
    glow: "glow-green",
    icon: "●",
  },
  delighted: {
    label: "Delighted",
    color: "text-blue-400",
    glow: "glow-blue",
    icon: "★",
  },
  confused: {
    label: "Confused",
    color: "text-yellow-400",
    glow: "glow-yellow",
    icon: "?",
  },
  frustrated: {
    label: "Frustrated",
    color: "text-red-400",
    glow: "glow-red",
    icon: "!",
  },
  bored: {
    label: "Bored",
    color: "text-gray-400",
    glow: "",
    icon: "—",
  },
};

interface WebcamFeedProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  isLoading: boolean;
  learningState: LearningState;
  engagementScore: number;
  onStart: () => void;
  onStop: () => void;
  error: string | null;
}

export default function WebcamFeed({
  videoRef,
  canvasRef,
  isActive,
  isLoading,
  learningState,
  engagementScore,
  onStart,
  onStop,
  error,
}: WebcamFeedProps) {
  const config = STATE_CONFIG[learningState];

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
      {/* Webcam view */}
      <div className="relative aspect-[4/3] bg-gray-950">
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover mirror"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ transform: "scaleX(-1)" }}
        />

        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950">
            {isLoading ? (
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  Loading emotion models...
                </p>
              </div>
            ) : (
              <div className="text-center px-4">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3">
                  <svg
                    className="w-8 h-8 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Enable your webcam for emotion-aware learning
                </p>
                {error && (
                  <p className="text-xs text-red-400 mb-3">{error}</p>
                )}
                <button
                  onClick={onStart}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
                >
                  Enable Camera
                </button>
              </div>
            )}
          </div>
        )}

        {/* Learning state overlay */}
        {isActive && (
          <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
            <div
              className={`px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm ${config.glow}`}
            >
              <span className={`text-sm font-medium ${config.color}`}>
                {config.icon} {config.label}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm">
              <span className="text-sm font-medium text-white">
                {engagementScore}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {isActive && (
        <div className="p-3 border-t border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-gray-400">Detecting</span>
          </div>
          <button
            onClick={onStop}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Disable Camera
          </button>
        </div>
      )}
    </div>
  );
}
