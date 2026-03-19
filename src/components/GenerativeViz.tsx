"use client";

import { useRef, useEffect, useCallback } from "react";
import { VERTEX_SHADER, FRAGMENT_SHADER } from "@/lib/viz-shaders";
import { AdaptiveEngine, VizParams } from "@/lib/adaptive-engine";
import { LearningState } from "@/hooks/useEmotionDetection";

interface EmotionParams {
  engagement: number; // 0-1
  valence: number; // -1 to 1
  arousal: number; // 0-1
  confusion: number; // 0-1
}

interface GenerativeVizProps {
  learningState: LearningState;
  engagementScore: number;
  emotions: {
    happy: number;
    angry: number;
    fearful: number;
    surprised: number;
    sad: number;
    neutral: number;
    disgusted: number;
  };
  isActive: boolean;
  className?: string;
}

function emotionsToParams(
  emotions: GenerativeVizProps["emotions"],
  engagementScore: number
): EmotionParams {
  const valence =
    emotions.happy * 1 +
    emotions.surprised * 0.3 -
    emotions.angry * 0.8 -
    emotions.sad * 0.5 -
    emotions.disgusted * 0.6;

  const arousal =
    emotions.happy * 0.6 +
    emotions.angry * 0.9 +
    emotions.surprised * 0.8 +
    emotions.fearful * 0.7 -
    emotions.neutral * 0.5 -
    emotions.sad * 0.3;

  return {
    engagement: engagementScore / 100,
    valence: Math.max(-1, Math.min(1, valence)),
    arousal: Math.max(0, Math.min(1, arousal * 1.5 + 0.3)),
    confusion: Math.min(1, emotions.fearful + emotions.surprised * 0.5),
  };
}

export default function GenerativeViz({
  learningState,
  engagementScore,
  emotions,
  isActive,
  className = "",
}: GenerativeVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const engineRef = useRef<AdaptiveEngine>(new AdaptiveEngine());
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const lastFrameRef = useRef<number>(Date.now());
  const prevStateRef = useRef<LearningState>("engaged");

  // Smoothly interpolated values (lerp targets)
  const smoothRef = useRef<EmotionParams>({
    engagement: 0.7,
    valence: 0,
    arousal: 0.3,
    confusion: 0,
  });
  const smoothVizRef = useRef<VizParams>(engineRef.current.getParams());

  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) return false;

    // Compile shaders
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERTEX_SHADER);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error("Vertex shader error:", gl.getShaderInfoLog(vs));
      return false;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAGMENT_SHADER);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error("Fragment shader error:", gl.getShaderInfoLog(fs));
      return false;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return false;
    }

    gl.useProgram(program);

    // Fullscreen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posAttr = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    // Cache uniform locations
    const uniformNames = [
      "u_time",
      "u_resolution",
      "u_engagement",
      "u_valence",
      "u_arousal",
      "u_confusion",
      "u_hueShift",
      "u_complexity",
      "u_speed",
      "u_symmetry",
      "u_zoom",
      "u_distortion",
    ];
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }

    glRef.current = gl;
    programRef.current = program;
    uniformsRef.current = uniforms;
    return true;
  }, []);

  const render = useCallback(() => {
    const gl = glRef.current;
    const u = uniformsRef.current;
    const canvas = canvasRef.current;
    if (!gl || !canvas) return;

    const now = Date.now();
    const deltaTime = (now - lastFrameRef.current) / 1000;
    lastFrameRef.current = now;

    // Resize canvas to display size
    const dpr = Math.min(window.devicePixelRatio, 2);
    const displayWidth = Math.floor(canvas.clientWidth * dpr);
    const displayHeight = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, displayWidth, displayHeight);
    }

    // Smooth emotion params (lerp toward targets)
    const lerpRate = 1 - Math.pow(0.05, deltaTime); // ~3 second smoothing
    const target = smoothRef.current;
    target.engagement += (target.engagement - target.engagement) * 0; // placeholder
    const s = smoothRef.current;

    // Update adaptive engine
    const vizParams = engineRef.current.update(
      s.engagement * 100,
      deltaTime
    );

    // Smooth viz params too
    const sv = smoothVizRef.current;
    const vizLerp = 1 - Math.pow(0.1, deltaTime);
    sv.hueShift += (vizParams.hueShift - sv.hueShift) * vizLerp;
    sv.complexity += (vizParams.complexity - sv.complexity) * vizLerp;
    sv.speed += (vizParams.speed - sv.speed) * vizLerp;
    sv.symmetry += (vizParams.symmetry - sv.symmetry) * vizLerp;
    sv.zoom += (vizParams.zoom - sv.zoom) * vizLerp;
    sv.distortion += (vizParams.distortion - sv.distortion) * vizLerp;

    // Set uniforms
    const time = (now - startTimeRef.current) / 1000;
    gl.uniform1f(u.u_time, time);
    gl.uniform2f(u.u_resolution, displayWidth, displayHeight);
    gl.uniform1f(u.u_engagement, s.engagement);
    gl.uniform1f(u.u_valence, s.valence);
    gl.uniform1f(u.u_arousal, s.arousal);
    gl.uniform1f(u.u_confusion, s.confusion);
    gl.uniform1f(u.u_hueShift, sv.hueShift);
    gl.uniform1f(u.u_complexity, sv.complexity);
    gl.uniform1f(u.u_speed, sv.speed);
    gl.uniform1f(u.u_symmetry, sv.symmetry);
    gl.uniform1f(u.u_zoom, sv.zoom);
    gl.uniform1f(u.u_distortion, sv.distortion);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    animFrameRef.current = requestAnimationFrame(render);
  }, []);

  // Initialize WebGL
  useEffect(() => {
    if (initGL()) {
      startTimeRef.current = Date.now();
      lastFrameRef.current = Date.now();
      animFrameRef.current = requestAnimationFrame(render);
    }
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [initGL, render]);

  // Update emotion targets when props change (no re-render needed)
  useEffect(() => {
    const target = emotionsToParams(emotions, engagementScore);
    const s = smoothRef.current;
    // Lerp toward new targets
    const rate = 0.15;
    s.engagement += (target.engagement - s.engagement) * rate;
    s.valence += (target.valence - s.valence) * rate;
    s.arousal += (target.arousal - s.arousal) * rate;
    s.confusion += (target.confusion - s.confusion) * rate;

    // React to learning state changes
    if (learningState !== prevStateRef.current) {
      engineRef.current.onEmotionShift(learningState);
      prevStateRef.current = learningState;
    }
  }, [emotions, engagementScore, learningState]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: "block" }}
      />
      {/* Subtle overlay info */}
      {isActive && (
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end pointer-events-none">
          <div className="text-[10px] text-white/40 font-mono">
            ADAPTIVE GENERATIVE
          </div>
          <div className="text-[10px] text-white/40 font-mono">
            {engagementScore}% ENGAGEMENT
          </div>
        </div>
      )}
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-[10px] text-white/30 font-mono tracking-widest uppercase">
            Enable camera to sync
          </div>
        </div>
      )}
    </div>
  );
}
