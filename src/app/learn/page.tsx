"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useEmotionDetection,
  LearningState,
} from "@/hooks/useEmotionDetection";
import WebcamFeed from "@/components/WebcamFeed";
import EmotionDashboard from "@/components/EmotionDashboard";
import MobileDrawer from "@/components/MobileDrawer";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function LearnPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const topic = searchParams.get("topic") || "General Knowledge";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAdaptationRef = useRef<number>(0);
  const prevLearningStateRef = useRef<LearningState>("engaged");

  const emotion = useEmotionDetection();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      sendMessage(
        `I want to learn about: ${topic}. Please start the lesson.`,
        true
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Adaptive intervention
  useEffect(() => {
    if (!emotion.isActive || messages.length < 2 || isStreaming) return;
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
      sendMessage(getAdaptationMessage(current), true);
    }
    prevLearningStateRef.current = current;
  }, [emotion.learningState, emotion.isActive, messages.length, isStreaming]);

  const sendMessage = useCallback(
    async (content: string, isSystem = false) => {
      if (isStreaming) return;
      const userMessage: Message = { role: "user", content };
      const newMessages =
        isSystem && messages.length === 0
          ? [userMessage]
          : [...messages, userMessage];
      if (!isSystem) {
        setMessages(newMessages);
      } else if (messages.length === 0) {
        setMessages([]);
      }
      setIsStreaming(true);
      setInput("");
      try {
        const emotionContext = emotion.isActive
          ? buildEmotionContext({
              learningState: emotion.learningState,
              engagementScore: emotion.engagementScore,
              currentEmotions: emotion.currentEmotions as unknown as Record<string, number>,
              history: emotion.history.map((h) => ({
                learningState: h.learningState,
                engagementScore: h.engagementScore,
                emotions: h.emotions as unknown as Record<string, number>,
              })),
            })
          : undefined;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            messages: newMessages,
            learningState: emotion.isActive ? emotion.learningState : undefined,
            engagementScore: emotion.isActive ? emotion.engagementScore : undefined,
            emotionContext,
          }),
        });
        if (!res.ok) throw new Error("API request failed");
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");
        const decoder = new TextDecoder();
        let assistantContent = "";
        setMessages((prev) => [
          ...(isSystem && prev.length === 0 ? [] : prev),
          ...(isSystem && messages.length > 0 ? [userMessage] : isSystem ? [] : []),
          { role: "assistant", content: "" },
        ]);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split("\n").filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              assistantContent += parsed.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "An error occurred. Please try again." },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, messages, topic, emotion.isActive, emotion.learningState, emotion.engagementScore]
  );

  return (
    <div className="h-[100dvh] flex flex-col">
      {/* Header */}
      <header className="border-b border-edge-subtle px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 safe-area-top">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="text-content-tertiary hover:text-content-primary transition-colors"
            aria-label="Go back"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-medium text-content-primary truncate">{topic}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {emotion.isActive && (
            <div className="flex items-center gap-1.5 text-xs text-content-tertiary tabular-nums">
              <div className={`w-1.5 h-1.5 rounded-full ${
                emotion.learningState === "engaged" || emotion.learningState === "delighted"
                  ? "bg-status-success"
                  : emotion.learningState === "confused"
                    ? "bg-status-warning"
                    : emotion.learningState === "frustrated"
                      ? "bg-status-danger"
                      : "bg-content-tertiary"
              }`} />
              <span className="hidden sm:inline">{emotion.engagementScore}%</span>
            </div>
          )}
          <button
            onClick={() => {
              if (window.innerWidth < 1024) setMobileDrawerOpen(true);
              else setShowSidebar(!showSidebar);
            }}
            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
              showSidebar || mobileDrawerOpen
                ? "border-accent/40 text-accent"
                : "border-edge-subtle text-content-tertiary hover:text-content-secondary"
            }`}
            aria-label="Toggle emotion dashboard"
          >
            <span className="sm:hidden">Monitor</span>
            <span className="hidden sm:inline">Monitoring</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Lesson content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
              {messages.filter((m) => m.content).map((msg, i) => (
                <div key={i} className="animate-fade-in">
                  {msg.role === "assistant" ? (
                    <div className="lesson-content text-[14px]">
                      <MarkdownContent content={msg.content} />
                    </div>
                  ) : (
                    <div className="my-6 py-3 px-4 rounded-lg bg-accent-subtle border border-accent/10 text-sm text-content-secondary">
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}
              {isStreaming && messages.length > 0 && messages[messages.length - 1]?.content === "" && (
                <div className="flex items-center gap-2 py-4 text-content-tertiary">
                  <div className="w-4 h-4 border border-content-tertiary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Generating lesson content...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-edge-subtle px-4 sm:px-6 py-3 flex-shrink-0 safe-area-bottom">
            <div className="max-w-2xl mx-auto flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && input.trim()) {
                    e.preventDefault();
                    sendMessage(input.trim());
                  }
                }}
                placeholder="Ask a question or request clarification..."
                disabled={isStreaming}
                className="flex-1 bg-surface-card border border-edge-subtle rounded-lg px-3 py-2 text-sm text-content-primary placeholder-content-tertiary focus:outline-none focus:border-accent disabled:opacity-50 transition-colors"
              />
              <button
                onClick={() => input.trim() && sendMessage(input.trim())}
                disabled={isStreaming || !input.trim()}
                className="px-3 py-2 bg-accent hover:bg-accent-hover disabled:bg-surface-elevated disabled:text-content-tertiary text-white text-sm rounded-lg transition-colors flex-shrink-0"
                aria-label="Send message"
              >
                <svg className="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                <span className="hidden sm:inline">Submit</span>
              </button>
            </div>
          </div>
        </div>

        {/* Desktop sidebar */}
        {showSidebar && (
          <div className="w-72 border-l border-edge-subtle overflow-y-auto p-3 space-y-3 flex-shrink-0 hidden lg:block">
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
        <div className="lg:hidden fixed bottom-16 right-3 z-40">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="w-10 h-10 rounded-full border shadow-sm flex items-center justify-center bg-surface-card/95 backdrop-blur"
            style={{
              borderColor:
                emotion.learningState === "engaged" || emotion.learningState === "delighted"
                  ? "#3fb950"
                  : emotion.learningState === "confused"
                    ? "#d29922"
                    : emotion.learningState === "frustrated"
                      ? "#f85149"
                      : "#484f58",
            }}
            aria-label={`Engagement ${emotion.engagementScore}%. Tap to open monitor.`}
          >
            <span className="text-[11px] font-medium tabular-nums text-content-secondary">
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

function getAdaptationMessage(state: LearningState): string {
  switch (state) {
    case "confused":
      return "[EMOTION ALERT: Learner facial analysis shows confusion. Rephrase your last point using a simpler analogy. Ask a quick check-in question.]";
    case "frustrated":
      return "[EMOTION ALERT: Learner is showing frustration. Step back, simplify dramatically, and give them something easy to succeed at before continuing.]";
    case "bored":
      return "[EMOTION ALERT: Learner engagement has dropped. Switch to something surprising, interactive, or challenging to recapture attention.]";
    default:
      return "[Continue teaching — learner appears engaged.]";
  }
}

function buildEmotionContext(emotion: {
  learningState: LearningState;
  engagementScore: number;
  currentEmotions: Record<string, number>;
  history: Array<{
    learningState: LearningState;
    engagementScore: number;
    emotions: Record<string, number>;
  }>;
}) {
  const history = emotion.history;
  const recent = history.slice(-10);
  const timeInState: Record<string, number> = {};
  for (const snap of history) {
    timeInState[snap.learningState] = (timeInState[snap.learningState] || 0) + 1;
  }
  let confusionEvents = 0;
  for (let i = 1; i < history.length; i++) {
    if (history[i].learningState === "confused" && history[i - 1].learningState !== "confused")
      confusionEvents++;
  }
  let recentTrend = "stable";
  if (recent.length >= 5) {
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const avgFirst = firstHalf.reduce((s, h) => s + h.engagementScore, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, h) => s + h.engagementScore, 0) / secondHalf.length;
    if (avgSecond - avgFirst > 5) recentTrend = "engagement rising";
    else if (avgFirst - avgSecond > 5) recentTrend = "engagement dropping";
  }
  const emotionBreakdown: Record<string, number> = {};
  for (const [key, value] of Object.entries(emotion.currentEmotions)) {
    emotionBreakdown[key] = Math.round((value as number) * 100);
  }
  return {
    currentState: emotion.learningState,
    engagementScore: emotion.engagementScore,
    emotionBreakdown,
    sessionStats: {
      avgEngagement:
        history.length > 0
          ? Math.round(history.reduce((s, h) => s + h.engagementScore, 0) / history.length)
          : emotion.engagementScore,
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
          <div className="w-5 h-5 border border-content-tertiary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LearnPageContent />
    </Suspense>
  );
}
