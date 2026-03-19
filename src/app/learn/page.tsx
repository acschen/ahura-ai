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
  const [showDashboard, setShowDashboard] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAdaptationRef = useRef<number>(0);
  const prevLearningStateRef = useRef<LearningState>("engaged");

  const emotion = useEmotionDetection();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start the lesson automatically
  useEffect(() => {
    if (messages.length === 0) {
      sendMessage(
        `I want to learn about: ${topic}. Please start the lesson.`,
        true
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Adaptive intervention: when learning state changes significantly
  useEffect(() => {
    if (!emotion.isActive || messages.length < 2 || isStreaming) return;

    const now = Date.now();
    const timeSinceLastAdaptation = now - lastAdaptationRef.current;
    if (timeSinceLastAdaptation < 30000) return;

    const prev = prevLearningStateRef.current;
    const current = emotion.learningState;

    const shouldAdapt =
      (current === "confused" && prev !== "confused") ||
      (current === "frustrated" && prev !== "frustrated") ||
      (current === "bored" && prev !== "bored");

    if (shouldAdapt) {
      lastAdaptationRef.current = now;
      const adaptMessage = getAdaptationMessage(current);
      sendMessage(adaptMessage, true);
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
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            messages: newMessages,
            learningState: emotion.isActive
              ? emotion.learningState
              : undefined,
            engagementScore: emotion.isActive
              ? emotion.engagementScore
              : undefined,
          }),
        });

        if (!res.ok) throw new Error("API request failed");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let assistantContent = "";

        setMessages((prev) => [
          ...(isSystem && prev.length === 0 ? [] : prev),
          ...(isSystem && messages.length > 0
            ? [userMessage]
            : isSystem
              ? []
              : []),
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
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return updated;
              });
            } catch {
              // skip parse errors
            }
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I encountered an error. Please try again or check your connection.",
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [
      isStreaming,
      messages,
      topic,
      emotion.isActive,
      emotion.learningState,
      emotion.engagementScore,
    ]
  );

  const stateColors: Record<LearningState, string> = {
    engaged: "bg-green-500",
    delighted: "bg-blue-500",
    confused: "bg-yellow-500",
    frustrated: "bg-red-500",
    bored: "bg-gray-500",
  };

  return (
    <div className="h-[100dvh] flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-3 sm:px-4 py-3 flex items-center justify-between flex-shrink-0 safe-area-top">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs sm:text-sm flex-shrink-0">
            A
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-white truncate">
              {topic}
            </h1>
            <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">
              Ahura AI Tutor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Mobile: compact emotion indicator */}
          {emotion.isActive && (
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${stateColors[emotion.learningState]} animate-pulse`}
              />
              <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:inline">
                Emotion AI Active
              </span>
            </div>
          )}

          {/* Mobile: open drawer. Desktop: toggle sidebar */}
          <button
            onClick={() => {
              // On mobile, open drawer. On desktop, toggle sidebar.
              if (window.innerWidth < 1024) {
                setMobileDrawerOpen(true);
              } else {
                setShowDashboard(!showDashboard);
              }
            }}
            className={`px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs rounded-lg border transition-colors ${
              showDashboard || mobileDrawerOpen
                ? "border-indigo-500 text-indigo-400"
                : "border-gray-700 text-gray-400"
            }`}
            aria-label="Toggle emotion dashboard"
          >
            <span className="sm:hidden">
              {emotion.isActive ? `${emotion.engagementScore}%` : "Camera"}
            </span>
            <span className="hidden sm:inline">Dashboard</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat / Lesson area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
            <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
              {messages
                .filter((m) => m.content)
                .map((msg, i) => (
                  <div
                    key={i}
                    className={`animate-fade-in ${
                      msg.role === "assistant" ? "" : "flex justify-end"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="flex gap-2 sm:gap-3">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                          <span className="text-[10px] sm:text-xs font-bold text-white">
                            A
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 lesson-content text-sm leading-relaxed overflow-x-auto">
                          <MarkdownContent content={msg.content} />
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-[85%] sm:max-w-lg bg-indigo-600/20 border border-indigo-500/30 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-gray-200">
                        {msg.content}
                      </div>
                    )}
                  </div>
                ))}
              {isStreaming && (
                <div className="flex gap-2 sm:gap-3 items-center">
                  <div className="w-6 sm:w-7 h-6 sm:h-7" />
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                    <div
                      className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-gray-800 p-2.5 sm:p-4 flex-shrink-0 safe-area-bottom">
            <div className="max-w-3xl mx-auto flex gap-2 sm:gap-3">
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
                placeholder="Ask a question..."
                disabled={isStreaming}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              />
              <button
                onClick={() => input.trim() && sendMessage(input.trim())}
                disabled={isStreaming || !input.trim()}
                className="px-3 sm:px-4 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0"
                aria-label="Send message"
              >
                {/* Icon on mobile, text on desktop */}
                <svg
                  className="w-5 h-5 sm:hidden"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </div>
        </div>

        {/* Desktop sidebar: Webcam + Dashboard */}
        {showDashboard && (
          <div className="w-80 border-l border-gray-800 overflow-y-auto p-4 space-y-4 flex-shrink-0 hidden lg:block">
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
            />
          </div>
        )}
      </div>

      {/* Mobile drawer for webcam + dashboard */}
      <MobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        title="Emotion Dashboard"
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
        />
      </MobileDrawer>

      {/* Mobile floating PiP webcam (when camera active & drawer closed) */}
      {emotion.isActive && !mobileDrawerOpen && (
        <div className="lg:hidden fixed bottom-20 right-3 z-40 safe-area-right">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 shadow-lg active:scale-95 transition-transform"
            style={{
              borderColor:
                emotion.learningState === "engaged"
                  ? "#10b981"
                  : emotion.learningState === "confused"
                    ? "#f59e0b"
                    : emotion.learningState === "frustrated"
                      ? "#ef4444"
                      : emotion.learningState === "delighted"
                        ? "#3b82f6"
                        : "#6b7280",
            }}
            aria-label={`Emotion: ${emotion.learningState}, engagement ${emotion.engagementScore}%. Tap to open dashboard.`}
          >
            {/* Mini engagement score */}
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
              <div className="text-center">
                <div
                  className="text-lg font-bold"
                  style={{
                    color:
                      emotion.learningState === "engaged"
                        ? "#10b981"
                        : emotion.learningState === "confused"
                          ? "#f59e0b"
                          : emotion.learningState === "frustrated"
                            ? "#ef4444"
                            : emotion.learningState === "delighted"
                              ? "#3b82f6"
                              : "#6b7280",
                  }}
                >
                  {emotion.engagementScore}%
                </div>
                <div className="text-[8px] text-gray-400 uppercase tracking-wider">
                  {emotion.learningState}
                </div>
              </div>
            </div>
            {/* Pulse ring */}
            <div
              className="absolute inset-0 rounded-2xl animate-ping opacity-20"
              style={{
                borderWidth: 2,
                borderStyle: "solid",
                borderColor:
                  emotion.learningState === "engaged"
                    ? "#10b981"
                    : emotion.learningState === "confused"
                      ? "#f59e0b"
                      : "#ef4444",
              }}
            />
          </button>
        </div>
      )}
    </div>
  );
}

// Simple markdown renderer
function MarkdownContent({ content }: { content: string }) {
  const html = content
    .replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      '<pre><code class="language-$1">$2</code></pre>'
    )
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
      return "[The learner's facial expressions indicate confusion. Please adjust your explanation — simplify, use an analogy, or ask a clarifying question.]";
    case "frustrated":
      return "[The learner appears frustrated. Please dramatically simplify your approach, acknowledge the difficulty, and provide an easier example or a different angle.]";
    case "bored":
      return "[The learner appears disengaged. Please make the content more challenging, present something surprising, or ask an engaging question to recapture their attention.]";
    default:
      return "[Continue with the current teaching approach.]";
  }
}

export default function LearnPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LearnPageContent />
    </Suspense>
  );
}
