"use client";

import { useEffect, useState } from "react";
import {
  EmotionScores,
  EmotionSnapshot,
  LearningState,
} from "@/hooks/useEmotionDetection";

const STATE_LABELS: Record<LearningState, { label: string; color: string }> = {
  engaged: { label: "Engaged", color: "#3fb950" },
  delighted: { label: "Engaged", color: "#3fb950" },
  confused: { label: "Needs clarification", color: "#d29922" },
  frustrated: { label: "Struggling", color: "#f85149" },
  bored: { label: "Disengaged", color: "#484f58" },
};

const EMOTION_COLORS: Record<keyof EmotionScores, string> = {
  happy: "#3fb950",
  surprised: "#2f81f7",
  neutral: "#484f58",
  sad: "#a371f7",
  angry: "#f85149",
  fearful: "#d29922",
  disgusted: "#db61a2",
};

interface EmotionDashboardProps {
  emotions: EmotionScores;
  learningState: LearningState;
  engagementScore: number;
  history: EmotionSnapshot[];
  isActive: boolean;
  faceDetected: boolean;
  lastUpdate: number;
}

export default function EmotionDashboard({
  emotions,
  learningState,
  engagementScore,
  history,
  isActive,
  faceDetected,
  lastUpdate,
}: EmotionDashboardProps) {
  const state = STATE_LABELS[learningState];

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const secondsAgo = lastUpdate ? Math.floor((Date.now() - lastUpdate) / 1000) : null;

  if (!isActive) {
    return (
      <div className="border border-edge-subtle rounded-lg p-4 bg-surface-card">
        <p className="text-xs text-content-tertiary text-center">
          Enable your camera to see real-time emotion analytics
        </p>
      </div>
    );
  }

  const stats = calcStats(history);

  return (
    <div className="space-y-2">
      {/* Status */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: faceDetected ? "#3fb950" : "#d29922" }}
          />
          <span className="text-[10px] text-content-tertiary">
            {faceDetected ? "Tracking" : "No face"}
          </span>
        </div>
        <span className="text-[10px] text-content-tertiary tabular-nums">
          {secondsAgo !== null ? (secondsAgo < 2 ? "Live" : `${secondsAgo}s`) : ""}
        </span>
      </div>

      {/* Engagement */}
      <div className="border border-edge-subtle rounded-lg p-3 bg-surface-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-content-secondary">
            {state.label}
          </span>
          <span
            className="text-lg font-semibold tabular-nums"
            style={{ color: state.color }}
          >
            {engagementScore}
          </span>
        </div>
        <div className="h-1 bg-surface-elevated rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${engagementScore}%`,
              backgroundColor: state.color,
            }}
          />
        </div>
      </div>

      {/* Expression breakdown */}
      <div className="border border-edge-subtle rounded-lg p-3 bg-surface-card">
        <div className="space-y-1">
          {(Object.keys(emotions) as Array<keyof EmotionScores>)
            .filter((key) => emotions[key] > 0.02)
            .sort((a, b) => emotions[b] - emotions[a])
            .map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-content-tertiary w-14 capitalize">
                  {key}
                </span>
                <div className="flex-1 h-[3px] bg-surface-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.round(emotions[key] * 100)}%`,
                      backgroundColor: EMOTION_COLORS[key],
                    }}
                  />
                </div>
                <span className="text-[10px] text-content-tertiary w-6 text-right tabular-nums">
                  {Math.round(emotions[key] * 100)}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Session */}
      {history.length > 5 && (
        <div className="border border-edge-subtle rounded-lg p-3 bg-surface-card">
          <div className="flex items-center justify-between text-[10px] text-content-tertiary mb-2">
            <span>Session</span>
            <span className="tabular-nums">{history.length} samples</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-sm font-medium text-content-primary tabular-nums">
                {stats.avg}
              </div>
              <div className="text-[9px] text-content-tertiary">Avg</div>
            </div>
            <div>
              <div className="text-sm font-medium text-content-primary tabular-nums">
                {stats.peak}
              </div>
              <div className="text-[9px] text-content-tertiary">Peak</div>
            </div>
            <div>
              <div className="text-sm font-medium text-content-primary tabular-nums">
                {stats.confused}
              </div>
              <div className="text-[9px] text-content-tertiary">Drops</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function calcStats(history: EmotionSnapshot[]) {
  if (history.length === 0) return { avg: 0, peak: 0, confused: 0 };
  const scores = history.map((h) => h.engagementScore);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const peak = Math.max(...scores);
  let confused = 0;
  for (let i = 1; i < history.length; i++) {
    if (
      history[i].learningState === "confused" &&
      history[i - 1].learningState !== "confused"
    )
      confused++;
  }
  return { avg, peak, confused };
}
