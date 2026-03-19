"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  OpenCVEmotionEngine,
  FaceAnalysis,
} from "@/lib/opencv-emotion";

export interface EmotionScores {
  neutral: number;
  happy: number;
  sad: number;
  angry: number;
  fearful: number;
  disgusted: number;
  surprised: number;
}

export type LearningState =
  | "engaged"
  | "confused"
  | "frustrated"
  | "bored"
  | "delighted";

export interface EmotionSnapshot {
  timestamp: number;
  emotions: EmotionScores;
  learningState: LearningState;
  engagementScore: number;
  faceAnalysis: FaceAnalysis | null;
}

const DEFAULT_EMOTIONS: EmotionScores = {
  neutral: 1,
  happy: 0,
  sad: 0,
  angry: 0,
  fearful: 0,
  disgusted: 0,
  surprised: 0,
};

// --- Performance: batch state updates to reduce re-renders ---
function analysisToEmotions(
  analysis: FaceAnalysis,
  recentAnalyses: FaceAnalysis[]
): EmotionScores {
  const { hasSmile, smileIntensity, eyeOpenness, motionLevel, expressionVariance } =
    analysis;

  const recentSmileRate =
    recentAnalyses.length > 0
      ? recentAnalyses.filter((a) => a.hasSmile).length / recentAnalyses.length
      : hasSmile ? 1 : 0;

  let happy = 0, surprised = 0, angry = 0, sad = 0, fearful = 0, disgusted = 0, neutral = 0;

  happy = hasSmile ? 0.4 + smileIntensity * 0.5 : recentSmileRate * 0.3;

  if (eyeOpenness > 0.7 && motionLevel > 0.4) {
    surprised = Math.min(1, (eyeOpenness - 0.5) * 2 + motionLevel * 0.5);
  }

  if (!hasSmile && eyeOpenness > 0.55 && expressionVariance > 0.4) {
    fearful = Math.min(0.8, (eyeOpenness - 0.4) * 1.5);
  }

  if (!hasSmile && eyeOpenness < 0.35 && expressionVariance > 0.45) {
    angry = Math.min(0.8, (0.5 - eyeOpenness) * 2 + expressionVariance * 0.3);
  }

  if (!hasSmile && motionLevel < 0.15 && expressionVariance > 0.3 && expressionVariance < 0.5) {
    sad = Math.min(0.6, 0.3 + (0.2 - motionLevel) * 2);
  }

  if (!hasSmile && eyeOpenness < 0.25) {
    disgusted = Math.min(0.5, (0.3 - eyeOpenness) * 3);
  }

  const totalExpression = happy + surprised + angry + sad + fearful + disgusted;
  neutral = totalExpression < 0.3 ? 1 - totalExpression : Math.max(0, 0.5 - totalExpression * 0.5);

  const total = happy + surprised + angry + sad + fearful + disgusted + neutral || 1;

  return {
    happy: happy / total,
    surprised: surprised / total,
    angry: angry / total,
    sad: sad / total,
    fearful: fearful / total,
    disgusted: disgusted / total,
    neutral: neutral / total,
  };
}

function classifyLearningState(
  emotions: EmotionScores,
  analysis: FaceAnalysis,
  history: EmotionSnapshot[]
): LearningState {
  const { happy, fearful, angry, surprised, disgusted } = emotions;

  if (happy > 0.5 && surprised > 0.1) return "delighted";
  if (happy > 0.6) return "delighted";
  if (angry > 0.25 || (angry > 0.15 && disgusted > 0.1)) return "frustrated";
  if (fearful > 0.2 && surprised > 0.1) return "confused";
  if (fearful > 0.3) return "confused";
  if (surprised > 0.35) return "confused";

  if (history.length >= 10) {
    const recent = history.slice(-10);
    const avgMotion = recent.reduce((s, h) => s + (h.faceAnalysis?.motionLevel ?? 0.3), 0) / recent.length;
    const avgNeutral = recent.reduce((s, h) => s + h.emotions.neutral, 0) / recent.length;
    if (avgMotion < 0.1 && avgNeutral > 0.6) return "bored";
    if (analysis.motionLevel < 0.05 && emotions.neutral > 0.7) return "bored";
  }

  return "engaged";
}

function calculateEngagement(
  emotions: EmotionScores,
  learningState: LearningState,
  analysis: FaceAnalysis
): number {
  const base: Record<LearningState, number> = {
    engaged: 78, delighted: 92, confused: 52, frustrated: 28, bored: 18,
  };
  let score = base[learningState];
  score += emotions.happy * 12;
  score += analysis.motionLevel * 8;
  score += analysis.expressionVariance * 6;
  score -= emotions.angry * 18;
  score -= emotions.sad * 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * PERFORMANCE OPTIMIZATIONS:
 * 1. Detection runs every 1000ms (was 500ms) — halves CPU load
 * 2. Video resolution 160x120 (was 320x240) — 4x fewer pixels to process
 * 3. State updates batched into single setState call
 * 4. Canvas overlay drawing skipped (viz replaces it)
 * 5. History limited to 60 entries (was 120)
 */
export function useEmotionDetection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentEmotions, setCurrentEmotions] = useState<EmotionScores>(DEFAULT_EMOTIONS);
  const [learningState, setLearningState] = useState<LearningState>("engaged");
  const [engagementScore, setEngagementScore] = useState(75);
  const [history, setHistory] = useState<EmotionSnapshot[]>([]);
  const [cameraPermission, setCameraPermission] = useState<"prompt" | "granted" | "denied">("prompt");

  const engineRef = useRef<OpenCVEmotionEngine | null>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyRef = useRef<EmotionSnapshot[]>([]);
  const recentAnalysesRef = useRef<FaceAnalysis[]>([]);

  const startDetection = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (!engineRef.current) {
        engineRef.current = new OpenCVEmotionEngine();
      }
      await engineRef.current.load();

      // PERF: Lower resolution = much less work for OpenCV
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 160, height: 120, facingMode: "user" },
      });
      setCameraPermission("granted");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
      setIsLoading(false);

      // PERF: Detect every 1000ms instead of 500ms
      detectionIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !engineRef.current) return;

        const analysis = engineRef.current.analyzeFrame(videoRef.current);
        if (!analysis) return;

        recentAnalysesRef.current = [
          ...recentAnalysesRef.current.slice(-15),
          analysis,
        ];

        const emotions = analysisToEmotions(analysis, recentAnalysesRef.current.slice(-10));
        const state = classifyLearningState(emotions, analysis, historyRef.current);
        const engagement = calculateEngagement(emotions, state, analysis);

        const snapshot: EmotionSnapshot = {
          timestamp: Date.now(),
          emotions,
          learningState: state,
          engagementScore: engagement,
          faceAnalysis: analysis,
        };

        // PERF: Shorter history
        historyRef.current = [...historyRef.current.slice(-60), snapshot];

        // PERF: Batch all state updates together
        setCurrentEmotions(emotions);
        setLearningState(state);
        setEngagementScore(engagement);
        setHistory((prev) => [...prev.slice(-60), snapshot]);
      }, 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Camera access denied";
      if (message.includes("Permission") || message.includes("NotAllowed")) {
        setCameraPermission("denied");
        setError("Camera permission denied. Please allow camera access.");
      } else {
        setError(message);
      }
      setIsLoading(false);
    }
  }, []);

  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopDetection();
      engineRef.current?.destroy();
    };
  }, [stopDetection]);

  return {
    videoRef,
    canvasRef,
    isActive,
    isLoading,
    error,
    currentEmotions,
    learningState,
    engagementScore,
    history,
    cameraPermission,
    startDetection,
    stopDetection,
  };
}
