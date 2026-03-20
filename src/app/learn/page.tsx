"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useEmotionDetection,
  LearningState,
  EmotionScores,
  EmotionSnapshot,
} from "@/hooks/useEmotionDetection";
import WebcamFeed from "@/components/WebcamFeed";
import EmotionDashboard from "@/components/EmotionDashboard";
import MobileDrawer from "@/components/MobileDrawer";

function LearnPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const topic = searchParams.get("topic") || "General Knowledge";

  // Content sections — each is a piece of lesson content
  const [sections, setSections] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const contentEndRef = useRef<HTMLDivElement>(null);
  const lastAdaptationRef = useRef<number>(0);
  const prevLearningStateRef = useRef<LearningState>("engaged");
  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const isGeneratingRef = useRef(false);

  const emotion = useEmotionDetection();
  const emotionRef = useRef(emotion);
  emotionRef.current = emotion;

  useEffect(() => {
    contentEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sections]);

  // Generate a section of content
  const generateSection = useCallback(
    async (prompt: string, isAdaptation = false) => {
      if (isGeneratingRef.current) return;
      isGeneratingRef.current = true;
      setIsGenerating(true);

      try {
        const em = emotionRef.current;
        const emotionContext = em.isActive
          ? buildEmotionContext(em.learningState, em.engagementScore, em.currentEmotions, em.history)
          : undefined;

        // Add the prompt to conversation history
        conversationRef.current = [
          ...conversationRef.current,
          { role: "user", content: prompt },
        ];

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            messages: conversationRef.current,
            learningState: em.isActive ? em.learningState : undefined,
            engagementScore: em.isActive ? em.engagementScore : undefined,
            emotionContext,
          }),
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let content = "";

        // Add new section
        setSections((prev) => [...prev, ""]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          for (const line of text.split("\n").filter((l) => l.startsWith("data: "))) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              content += JSON.parse(data).text;
              setSections((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = content;
                return updated;
              });
            } catch { /* skip */ }
          }
        }

        // Store in conversation
        conversationRef.current = [
          ...conversationRef.current,
          { role: "assistant", content },
        ];
        setSectionIndex((prev) => prev + 1);
      } catch (err) {
        console.error("Generation error:", err);
      } finally {
        isGeneratingRef.current = false;
        setIsGenerating(false);
      }
    },
    [topic]
  );

  // Start initial lesson
  useEffect(() => {
    if (sections.length === 0) {
      generateSection(
        `Teach me about: ${topic}. Start with the first section — an introduction and overview. Write it as clear, readable prose for a professional learner. Keep this section focused and concise.`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-continue: when the user finishes reading (scrolls near bottom), generate next section
  useEffect(() => {
    if (isGenerating || sections.length === 0) return;

    const handleScroll = () => {
      const el = document.querySelector("[data-lesson-scroll]");
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const nearBottom = scrollHeight - scrollTop - clientHeight < 150;

      if (nearBottom && !isGeneratingRef.current) {
        const em = emotionRef.current;
        const stateHint = em.isActive
          ? ` The learner's current state is: ${em.learningState} (engagement: ${em.engagementScore}%).`
          : "";
        generateSection(
          `Continue to the next section of this lesson.${stateHint} Build on what you've covered so far. Write the next focused section.`
        );
      }
    };

    const el = document.querySelector("[data-lesson-scroll]");
    el?.addEventListener("scroll", handleScroll, { passive: true });
    return () => el?.removeEventListener("scroll", handleScroll);
  }, [isGenerating, sections.length, generateSection]);

  // Emotion-based adaptation: when learner is struggling, inject adapted content
  useEffect(() => {
    if (!emotion.isActive || isGenerating) return;
    if (sections.length < 1) return;

    const now = Date.now();
    if (now - lastAdaptationRef.current < 15000) return;

    const prev = prevLearningStateRef.current;
    const current = emotion.learningState;

    const shouldAdapt =
      (current === "confused" && prev !== "confused") ||
      current === "frustrated" ||
      (current === "bored" && prev !== "bored");

    if (shouldAdapt) {
      lastAdaptationRef.current = now;
      const prompt = getAdaptationPrompt(current);
      generateSection(prompt, true);
    }

    prevLearningStateRef.current = current;
  }, [emotion.learningState, emotion.isActive, isGenerating, sections.length, generateSection]);

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      {/* Header */}
      <header className="border-b border-edge-subtle flex items-center justify-between flex-shrink-0 safe-area-top h-11">
        <div className="flex items-center gap-2 min-w-0 pl-5">
          <button
            onClick={() => router.push("/")}
            className="text-content-tertiary hover:text-content-primary transition-colors p-1 -ml-1"
            aria-label="Back to courses"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-[13px] font-medium text-content-primary truncate">{topic}</span>
        </div>
        <div className="flex items-center gap-2 pr-5">
          {emotion.isActive && (
            <>
              <span className="text-[11px] text-content-tertiary tabular-nums">
                {emotion.engagementScore}%
              </span>
              <div className={`w-1.5 h-1.5 rounded-full ${
                emotion.learningState === "engaged" || emotion.learningState === "delighted"
                  ? "bg-status-success"
                  : emotion.learningState === "confused"
                    ? "bg-status-warning"
                    : emotion.learningState === "frustrated"
                      ? "bg-status-danger"
                      : "bg-content-tertiary"
              }`} />
            </>
          )}
          <button
            onClick={() => {
              if (window.innerWidth < 1024) setMobileDrawerOpen(true);
              else setShowSidebar(!showSidebar);
            }}
            className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
              showSidebar || mobileDrawerOpen
                ? "border-accent/30 text-accent"
                : "border-edge-subtle text-content-tertiary hover:text-content-secondary"
            }`}
            aria-label="Toggle comprehension monitor"
          >
            Monitor
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Reading area */}
        <div className="flex-1 overflow-y-auto" data-lesson-scroll>
          <article className="max-w-[620px] mx-auto px-5 sm:px-8 py-10 sm:py-14">
            {/* Topic header */}
            <div className="mb-10 pb-6 border-b border-edge-subtle">
              <h1 className="text-xl sm:text-2xl font-semibold text-content-primary leading-tight mb-2">
                {topic}
              </h1>
              <p className="text-[13px] text-content-tertiary">
                Adaptive lesson {emotion.isActive ? "· Comprehension monitoring active" : ""}
              </p>
            </div>

            {/* Lesson sections */}
            {sections.map((content, i) => (
              <div key={i} className="animate-fade-in">
                {i > 0 && <div className="my-10 border-t border-edge-subtle" />}
                <div className="lesson-content text-[14px] leading-[1.8]">
                  <MarkdownContent content={content} />
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isGenerating && (
              <div className="flex items-center gap-2 py-8 text-content-tertiary">
                <div className="w-3 h-3 border border-content-tertiary/40 border-t-transparent rounded-full animate-spin" />
                <span className="text-[12px]">
                  {sections.length === 0 ? "Preparing lesson..." : "Loading next section..."}
                </span>
              </div>
            )}

            {/* Continue prompt */}
            {!isGenerating && sections.length > 0 && (
              <div className="py-10 text-center">
                <button
                  onClick={() => {
                    const em = emotionRef.current;
                    const stateHint = em.isActive
                      ? ` The learner's current state is: ${em.learningState} (engagement: ${em.engagementScore}%).`
                      : "";
                    generateSection(
                      `Continue to the next section of this lesson.${stateHint} Build on what you've covered. Write the next focused section.`
                    );
                  }}
                  className="text-[12px] text-content-tertiary hover:text-accent transition-colors"
                >
                  Continue reading
                </button>
              </div>
            )}
            <div ref={contentEndRef} />
          </article>
        </div>

        {/* Desktop sidebar */}
        {showSidebar && (
          <div className="w-60 border-l border-edge-subtle overflow-y-auto p-3 space-y-2.5 flex-shrink-0 hidden lg:block">
            <WebcamFeed
              videoRef={emotion.videoRef}
              canvasRef={emotion.canvasRef}
              isActive={emotion.isActive}
              isLoading={emotion.isLoading}
              learningState={emotion.learningState}
              engagementScore={emotion.engagementScore}
              onStart={emotion.startDetection}
              onStop={emotion.stopDetection}
              error={emotion.error}
            />
            <EmotionDashboard
              emotions={emotion.currentEmotions}
              learningState={emotion.learningState}
              engagementScore={emotion.engagementScore}
              history={emotion.history}
              isActive={emotion.isActive}
              faceDetected={emotion.faceDetected}
              lastUpdate={emotion.lastUpdate}
            />
          </div>
        )}
      </div>

      {/* Mobile drawer */}
      <MobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        title="Comprehension Monitor"
      >
        <WebcamFeed
          videoRef={emotion.videoRef}
          canvasRef={emotion.canvasRef}
          isActive={emotion.isActive}
          isLoading={emotion.isLoading}
          learningState={emotion.learningState}
          engagementScore={emotion.engagementScore}
          onStart={emotion.startDetection}
          onStop={emotion.stopDetection}
          error={emotion.error}
        />
        <EmotionDashboard
          emotions={emotion.currentEmotions}
          learningState={emotion.learningState}
          engagementScore={emotion.engagementScore}
          history={emotion.history}
          isActive={emotion.isActive}
          faceDetected={emotion.faceDetected}
          lastUpdate={emotion.lastUpdate}
        />
      </MobileDrawer>

      {/* Mobile floating indicator */}
      {emotion.isActive && !mobileDrawerOpen && (
        <div className="lg:hidden fixed bottom-6 right-4 z-40">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="w-9 h-9 rounded-full border flex items-center justify-center bg-surface-card/90 backdrop-blur-sm"
            style={{
              borderColor:
                emotion.learningState === "engaged" || emotion.learningState === "delighted"
                  ? "#3fb950" : emotion.learningState === "confused"
                    ? "#d29922" : emotion.learningState === "frustrated"
                      ? "#f85149" : "#30363d",
            }}
            aria-label="Open comprehension monitor"
          >
            <span className="text-[10px] font-medium tabular-nums text-content-secondary">
              {emotion.engagementScore}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const html = content
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");
  return <div dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />;
}

function getAdaptationPrompt(state: LearningState): string {
  switch (state) {
    case "confused":
      return "The learner's facial expressions show confusion about what was just explained. Rewrite or expand on the previous concept using a completely different, simpler analogy. Do not repeat what you already said — explain it from a new angle as if they are encountering it for the first time.";
    case "frustrated":
      return "The learner appears frustrated with the material. Step back to something more fundamental they can grasp easily. Build their confidence with a clear, simple explanation before gradually reconnecting to the harder concept.";
    case "bored":
      return "The learner appears disengaged. Present something unexpected — a surprising fact, a real-world consequence, a counterintuitive example, or a thought-provoking question related to the topic. Make them curious again.";
    default:
      return "Continue to the next section, maintaining the current pace and difficulty.";
  }
}

function buildEmotionContext(
  learningState: LearningState,
  engagementScore: number,
  currentEmotions: EmotionScores,
  history: EmotionSnapshot[]
) {
  const timeInState: Record<string, number> = {};
  for (const snap of history) {
    timeInState[snap.learningState] = (timeInState[snap.learningState] || 0) + 1;
  }
  let confusionEvents = 0;
  for (let i = 1; i < history.length; i++) {
    if (history[i].learningState === "confused" && history[i - 1].learningState !== "confused")
      confusionEvents++;
  }
  const recent = history.slice(-10);
  let recentTrend = "stable";
  if (recent.length >= 5) {
    const first = recent.slice(0, Math.floor(recent.length / 2));
    const second = recent.slice(Math.floor(recent.length / 2));
    const a1 = first.reduce((s, h) => s + h.engagementScore, 0) / first.length;
    const a2 = second.reduce((s, h) => s + h.engagementScore, 0) / second.length;
    if (a2 - a1 > 5) recentTrend = "engagement rising";
    else if (a1 - a2 > 5) recentTrend = "engagement dropping";
  }
  const breakdown: Record<string, number> = {};
  for (const [k, v] of Object.entries(currentEmotions)) {
    breakdown[k] = Math.round((v as number) * 100);
  }
  return {
    currentState: learningState,
    engagementScore,
    emotionBreakdown: breakdown,
    sessionStats: {
      avgEngagement: history.length > 0
        ? Math.round(history.reduce((s, h) => s + h.engagementScore, 0) / history.length)
        : engagementScore,
      samplesCollected: history.length,
      confusionEvents,
      timeInState,
    },
    recentTrend,
  };
}

export default function LearnPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] flex items-center justify-center bg-surface-primary">
          <div className="w-4 h-4 border border-content-tertiary/40 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LearnPageContent />
    </Suspense>
  );
}
