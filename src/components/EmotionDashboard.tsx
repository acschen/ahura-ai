"use client";

import {
  EmotionScores,
  EmotionSnapshot,
  LearningState,
} from "@/hooks/useEmotionDetection";

const LEARNING_STATE_INFO: Record<
  LearningState,
  { label: string; color: string; bg: string }
> = {
  engaged: {
    label: "ENGAGED",
    color: "#10b981",
    bg: "bg-green-500/10 border-green-500/30",
  },
  delighted: {
    label: "BREAKTHROUGH",
    color: "#3b82f6",
    bg: "bg-blue-500/10 border-blue-500/30",
  },
  confused: {
    label: "CONFUSED",
    color: "#f59e0b",
    bg: "bg-yellow-500/10 border-yellow-500/30",
  },
  frustrated: {
    label: "FRUSTRATED",
    color: "#ef4444",
    bg: "bg-red-500/10 border-red-500/30",
  },
  bored: {
    label: "DISENGAGED",
    color: "#6b7280",
    bg: "bg-gray-500/10 border-gray-500/30",
  },
};

const EMOTION_COLORS: Record<keyof EmotionScores, string> = {
  happy: "#10b981",
  surprised: "#3b82f6",
  neutral: "#6b7280",
  sad: "#8b5cf6",
  angry: "#ef4444",
  fearful: "#f59e0b",
  disgusted: "#ec4899",
};

interface EmotionDashboardProps {
  emotions: EmotionScores;
  learningState: LearningState;
  engagementScore: number;
  history: EmotionSnapshot[];
  isActive: boolean;
}

export default function EmotionDashboard({
  emotions,
  learningState,
  engagementScore,
  history,
  isActive,
}: EmotionDashboardProps) {
  const stateInfo = LEARNING_STATE_INFO[learningState];

  if (!isActive) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
        <p className="text-xs text-gray-500 text-center">
          Enable your camera to see real-time emotion analytics
        </p>
      </div>
    );
  }

  const sessionStats = calcStats(history);

  return (
    <div className="space-y-3">
      {/* State + engagement */}
      <div
        className={`border rounded-xl p-3 transition-all duration-700 ${stateInfo.bg}`}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[10px] font-bold tracking-widest transition-colors duration-700"
            style={{ color: stateInfo.color }}
          >
            {stateInfo.label}
          </span>
          <span
            className="text-xl font-bold tabular-nums transition-colors duration-700"
            style={{ color: stateInfo.color }}
          >
            {engagementScore}
          </span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${engagementScore}%`,
              backgroundColor: stateInfo.color,
            }}
          />
        </div>
      </div>

      {/* Expression bars */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
        <div className="space-y-1.5">
          {(Object.keys(emotions) as Array<keyof EmotionScores>).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-14 capitalize">
                {key}
              </span>
              <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.round(emotions[key] * 100)}%`,
                    backgroundColor: EMOTION_COLORS[key],
                  }}
                />
              </div>
              <span className="text-[10px] text-gray-600 w-7 text-right tabular-nums">
                {Math.round(emotions[key] * 100)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Session stats */}
      {history.length > 5 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-sm font-bold text-indigo-400 tabular-nums">
                {sessionStats.avg}%
              </div>
              <div className="text-[9px] text-gray-600">AVG</div>
            </div>
            <div>
              <div className="text-sm font-bold text-green-400 tabular-nums">
                {sessionStats.peak}%
              </div>
              <div className="text-[9px] text-gray-600">PEAK</div>
            </div>
            <div>
              <div className="text-sm font-bold text-yellow-400 tabular-nums">
                {sessionStats.confused}
              </div>
              <div className="text-[9px] text-gray-600">CONFUSED</div>
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
