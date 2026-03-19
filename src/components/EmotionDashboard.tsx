"use client";

import {
  EmotionScores,
  EmotionSnapshot,
  LearningState,
} from "@/hooks/useEmotionDetection";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const EMOTION_COLORS: Record<keyof EmotionScores, string> = {
  happy: "#10b981",
  surprised: "#3b82f6",
  neutral: "#6b7280",
  sad: "#8b5cf6",
  angry: "#ef4444",
  fearful: "#f59e0b",
  disgusted: "#ec4899",
};

const LEARNING_STATE_INFO: Record<
  LearningState,
  { label: string; color: string; bg: string; description: string }
> = {
  engaged: {
    label: "ENGAGED",
    color: "#10b981",
    bg: "bg-green-500/10 border-green-500/30",
    description: "Optimal learning state — maintaining pace",
  },
  delighted: {
    label: "BREAKTHROUGH",
    color: "#3b82f6",
    bg: "bg-blue-500/10 border-blue-500/30",
    description: "Eureka moment detected — building momentum",
  },
  confused: {
    label: "CONFUSED",
    color: "#f59e0b",
    bg: "bg-yellow-500/10 border-yellow-500/30",
    description: "Productive struggle — AI adapting difficulty",
  },
  frustrated: {
    label: "FRUSTRATED",
    color: "#ef4444",
    bg: "bg-red-500/10 border-red-500/30",
    description: "Intervention needed — simplifying content",
  },
  bored: {
    label: "DISENGAGED",
    color: "#6b7280",
    bg: "bg-gray-500/10 border-gray-500/30",
    description: "Low engagement — increasing challenge",
  },
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

  // Prepare chart data (last 60 snapshots)
  const chartData = history.slice(-60).map((snap, i) => ({
    time: i,
    engagement: snap.engagementScore,
    happy: Math.round(snap.emotions.happy * 100),
    confused:
      Math.round(snap.emotions.fearful * 100) +
      Math.round(snap.emotions.surprised * 50),
    frustrated:
      Math.round(snap.emotions.angry * 100) +
      Math.round(snap.emotions.disgusted * 50),
  }));

  // Calculate session stats
  const sessionStats = calculateSessionStats(history);

  if (!isActive) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          Emotion Dashboard
        </h3>
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">
            Enable your camera to see real-time emotion analytics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current State Banner */}
      <div
        className={`border rounded-xl p-4 ${stateInfo.bg} transition-all duration-500`}
      >
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-xs font-bold tracking-widest"
            style={{ color: stateInfo.color }}
          >
            {stateInfo.label}
          </span>
          <span
            className="text-2xl font-bold"
            style={{ color: stateInfo.color }}
          >
            {engagementScore}
          </span>
        </div>
        <p className="text-xs text-gray-400">{stateInfo.description}</p>

        {/* Engagement bar */}
        <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 emotion-bar"
            style={{
              width: `${engagementScore}%`,
              backgroundColor: stateInfo.color,
            }}
          />
        </div>
      </div>

      {/* Emotion Bars */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <h3 className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">
          Expression Analysis
        </h3>
        <div className="space-y-2">
          {(Object.keys(emotions) as Array<keyof EmotionScores>).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16 capitalize">
                {key}
              </span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full emotion-bar"
                  style={{
                    width: `${Math.round(emotions[key] * 100)}%`,
                    backgroundColor: EMOTION_COLORS[key],
                  }}
                />
              </div>
              <span className="text-xs text-gray-500 w-8 text-right">
                {Math.round(emotions[key] * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Chart */}
      {chartData.length > 5 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <h3 className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">
            Engagement Timeline
          </h3>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="engagementGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} hide />
                <Tooltip
                  contentStyle={{
                    background: "#1e1b4b",
                    border: "1px solid #312e81",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ display: "none" }}
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="#6366f1"
                  fill="url(#engagementGrad)"
                  strokeWidth={2}
                  name="Engagement"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Session Stats */}
      {history.length > 5 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <h3 className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">
            Session Insights
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-indigo-400">
                {sessionStats.avgEngagement}%
              </div>
              <div className="text-xs text-gray-500">Avg Engagement</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-400">
                {sessionStats.peakEngagement}%
              </div>
              <div className="text-xs text-gray-500">Peak</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-400">
                {sessionStats.confusionEvents}
              </div>
              <div className="text-xs text-gray-500">Confusion Events</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-400">
                {sessionStats.breakthroughs}
              </div>
              <div className="text-xs text-gray-500">Breakthroughs</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function calculateSessionStats(history: EmotionSnapshot[]) {
  if (history.length === 0)
    return {
      avgEngagement: 0,
      peakEngagement: 0,
      confusionEvents: 0,
      breakthroughs: 0,
    };

  const engagements = history.map((h) => h.engagementScore);
  const avgEngagement = Math.round(
    engagements.reduce((a, b) => a + b, 0) / engagements.length
  );
  const peakEngagement = Math.max(...engagements);

  // Count state transitions
  let confusionEvents = 0;
  let breakthroughs = 0;
  for (let i = 1; i < history.length; i++) {
    if (
      history[i].learningState === "confused" &&
      history[i - 1].learningState !== "confused"
    )
      confusionEvents++;
    if (
      history[i].learningState === "delighted" &&
      history[i - 1].learningState !== "delighted"
    )
      breakthroughs++;
  }

  return { avgEngagement, peakEngagement, confusionEvents, breakthroughs };
}
