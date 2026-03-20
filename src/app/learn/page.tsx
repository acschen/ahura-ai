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

  // Use refs for values needed in callbacks to avoid stale closures
  const messagesRef = useRef<Message[]>([]);
  const isStreamingRef = useRef(false);
  messagesRef.current = messages;
  isStreamingRef.current = isStreaming;

  const emotion = useEmotionDetection();
  const emotionRef = useRef(emotion);
  emotionRef.current = emotion;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send a message to the API with current emotion context
  const sendToAPI = useCallback(
    async (allMessages: Message[], hiddenSystemMsg = false) => {
      if (isStreamingRef.current) return;
      setIsStreaming(true);

      try {
        const em = emotionRef.current;
        const emotionContext = em.isActive
          ? buildEmotionContext(em.learningState, em.engagementScore, em.currentEmotions, em.history)
          : undefined;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            messages: allMessages,
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

        // Add empty assistant message
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          for (const line of text.split("\n").filter((l) => l.startsWith("data: "))) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              content += JSON.parse(data).text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content };
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
    [topic]
  );

  // Initial lesson
  useEffect(() => {
    if (messages.length === 0) {
      const initMsg: Message = { role: "user", content: `I want to learn about: ${topic}. Please start the lesson.` };
      sendToAPI([initMsg]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Adaptive intervention — fires when emotion state shifts negatively
  useEffect(() => {
    if (!emotion.isActive || isStreaming) return;
    if (messagesRef.current.length < 2) return;

    const now = Date.now();
    if (now - lastAdaptationRef.current < 12000) return;

    const prev = prevLearningStateRef.current;
    const current = emotion.learningState;

    const shouldAdapt =
      (current === "confused" && prev !== "confused") ||
      current === "frustrated" ||
      (current === "bored" && prev !== "bored");

    if (shouldAdapt) {
      lastAdaptationRef.current = now;

      // Inject a hidden system message into the conversation and call the API
      const adaptMsg: Message = {
        role: "user",
        content: getAdaptationMessage(current),
      };
      const allMessages = [...messagesRef.current, adaptMsg];
      setMessages(allMessages);
      sendToAPI(allMessages, true);
    }

    prevLearningStateRef.current = current;
  }, [emotion.learningState, emotion.isActive, isStreaming, sendToAPI]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    const userMsg: Message = { role: "user", content: text };
    const allMessages = [...messagesRef.current, userMsg];
    setMessages(allMessages);
    sendToAPI(allMessages);
  }, [input, isStreaming, sendToAPI]);

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-primary">
      {/* Header */}
      <header className="border-b border-edge-subtle flex items-center justify-between flex-shrink-0 safe-area-top h-12">
        <div className="flex items-center gap-2 min-w-0 pl-4 sm:pl-5">
          <button
            onClick={() => router.push("/")}
            className="text-content-tertiary hover:text-content-primary transition-colors p-1 -ml-1"
            aria-label="Go back"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-sm font-medium text-content-primary truncate">{topic}</h1>
        </div>
        <div className="flex items-center gap-2 pr-4 sm:pr-5">
          {emotion.isActive && (
            <span className="text-[11px] text-content-tertiary tabular-nums hidden sm:block">
              {emotion.engagementScore}%
            </span>
          )}
          {emotion.isActive && (
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              emotion.learningState === "engaged" || emotion.learningState === "delighted"
                ? "bg-status-success"
                : emotion.learningState === "confused"
                  ? "bg-status-warning"
                  : emotion.learningState === "frustrated"
                    ? "bg-status-danger"
                    : "bg-content-tertiary"
            }`} />
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
            aria-label="Toggle emotion dashboard"
          >
            Monitor
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Lesson content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[640px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
              {messages.filter((m) => m.content).map((msg, i) => (
                <div key={i} className="animate-fade-in">
                  {msg.role === "assistant" ? (
                    <div className="lesson-content text-[14px] leading-[1.75]">
                      <MarkdownContent content={msg.content} />
                    </div>
                  ) : (
                    !msg.content.startsWith("[EMOTION ALERT") && (
                      <div className="my-8 py-3 px-4 rounded border border-edge-subtle bg-surface-card text-[13px] text-content-secondary">
                        {msg.content}
                      </div>
                    )
                  )}
                </div>
              ))}
              {isStreaming && messages.length > 0 && messages[messages.length - 1]?.content === "" && (
                <div className="flex items-center gap-2 py-6 text-content-tertiary">
                  <div className="w-3.5 h-3.5 border border-content-tertiary/50 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px]">Generating...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-edge-subtle flex-shrink-0 safe-area-bottom">
            <div className="max-w-[640px] mx-auto px-5 sm:px-8 py-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask a question or request clarification..."
                  disabled={isStreaming}
                  className="flex-1 bg-surface-card border border-edge-subtle rounded px-3 py-2 text-[13px] text-content-primary placeholder-content-tertiary focus:outline-none focus:border-accent/50 disabled:opacity-40 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={isStreaming || !input.trim()}
                  className="px-3 py-2 bg-accent hover:bg-accent-hover disabled:bg-surface-elevated disabled:text-content-tertiary text-white text-[13px] rounded transition-colors flex-shrink-0"
                  aria-label="Send message"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop sidebar */}
        {showSidebar && (
          <div className="w-64 border-l border-edge-subtle overflow-y-auto p-3 space-y-2.5 flex-shrink-0 hidden lg:block">
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
        <div className="lg:hidden fixed bottom-14 right-4 z-40">
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
          <div className="w-4 h-4 border border-content-tertiary/50 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LearnPageContent />
    </Suspense>
  );
}
