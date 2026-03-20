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
  const [faceDetected, setFaceDetected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
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

      // Use 320x240 — small enough for perf, large enough for reliable face detection
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
      setCameraPermission("granted");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
      setIsLoading(false);

      // Detect every 800ms — good balance of responsiveness and perf
      detectionIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !engineRef.current) return;

        const analysis = engineRef.current.analyzeFrame(videoRef.current);

        // Always update timestamp so UI shows it's live
        setLastUpdate(Date.now());

        if (!analysis) {
          setFaceDetected(false);
          // Clear the canvas overlay when no face
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
              canvasRef.current.width = videoRef.current!.videoWidth;
              canvasRef.current.height = videoRef.current!.videoHeight;
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          }
          return;
        }

        setFaceDetected(true);

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

        historyRef.current = [...historyRef.current.slice(-60), snapshot];

        // Batch state updates
        setCurrentEmotions(emotions);
        setLearningState(state);
        setEngagementScore(engagement);
        setHistory((prev) => [...prev.slice(-60), snapshot]);

        // Draw face overlay on the webcam canvas
        if (canvasRef.current && videoRef.current) {
          engineRef.current!.drawOverlay(
            canvasRef.current,
            analysis,
            videoRef.current.videoWidth,
            videoRef.current.videoHeight,
            state,
            engagement
          );
        }
      }, 800);
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
    setFaceDetected(false);
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
    faceDetected,
    lastUpdate,
    cameraPermission,
    startDetection,
    stopDetection,
  };
}
