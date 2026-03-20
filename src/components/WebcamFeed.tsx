"use client";

import { RefObject } from "react";
import { LearningState } from "@/hooks/useEmotionDetection";

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
  return (
    <div className="border border-edge-subtle rounded-lg overflow-hidden bg-surface-card">
      <div className="relative aspect-[4/3] bg-surface-primary">
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ transform: "scaleX(-1)" }}
        />

        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-primary">
            {isLoading ? (
              <div className="text-center">
                <div className="w-5 h-5 border border-content-tertiary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-content-tertiary">
                  Initializing...
                </p>
              </div>
            ) : (
              <div className="text-center px-4">
                <p className="text-xs text-content-tertiary mb-3">
                  Enable camera for comprehension monitoring
                </p>
                {error && (
                  <p className="text-[11px] text-status-danger mb-2">{error}</p>
                )}
                <button
                  onClick={onStart}
                  className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs rounded-md transition-colors"
                >
                  Enable Camera
                </button>
              </div>
            )}
          </div>
        )}

        {isActive && (
          <div className="absolute top-1.5 left-1.5 right-1.5 flex justify-between items-start">
            <div className="px-2 py-1 rounded bg-black/50 backdrop-blur-sm">
              <span className={`text-[10px] font-medium ${
                learningState === "engaged" || learningState === "delighted"
                  ? "text-status-success"
                  : learningState === "confused"
                    ? "text-status-warning"
                    : learningState === "frustrated"
                      ? "text-status-danger"
                      : "text-content-tertiary"
              }`}>
                {learningState.charAt(0).toUpperCase() + learningState.slice(1)}
              </span>
            </div>
            <div className="px-2 py-1 rounded bg-black/50 backdrop-blur-sm">
              <span className="text-[10px] font-medium text-content-primary tabular-nums">
                {engagementScore}%
              </span>
            </div>
          </div>
        )}
      </div>

      {isActive && (
        <div className="px-2.5 py-1.5 flex justify-between items-center border-t border-edge-subtle">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-status-danger animate-pulse" />
            <span className="text-[10px] text-content-tertiary">Recording</span>
          </div>
          <button
            onClick={onStop}
            className="text-[10px] text-content-tertiary hover:text-content-secondary transition-colors"
          >
            Disable
          </button>
        </div>
      )}
    </div>
  );
}
