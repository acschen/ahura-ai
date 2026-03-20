"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const COURSES = [
  {
    title: "Data Privacy & Compliance",
    category: "Regulation",
    description: "GDPR, CCPA, and federal data handling requirements",
  },
  {
    title: "Cybersecurity Fundamentals",
    category: "Security",
    description: "Threat models, incident response, and defense strategies",
  },
  {
    title: "AI & Machine Learning",
    category: "Technology",
    description: "Core concepts, applications, and responsible AI practices",
  },
  {
    title: "Cloud Infrastructure",
    category: "Technology",
    description: "Cloud architecture, migration strategies, and DevOps",
  },
  {
    title: "Project Management",
    category: "Leadership",
    description: "Agile methodologies, stakeholder management, and delivery",
  },
  {
    title: "Public Policy Analysis",
    category: "Governance",
    description: "Evidence-based policy design and impact assessment",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Regulation: "text-amber-500 bg-amber-500/8",
  Security: "text-red-400 bg-red-400/8",
  Technology: "text-accent bg-accent-subtle",
  Leadership: "text-emerald-400 bg-emerald-400/8",
  Governance: "text-violet-400 bg-violet-400/8",
};

export default function HomePage() {
  const [customTopic, setCustomTopic] = useState("");
  const router = useRouter();

  const startLearning = (topic: string) => {
    if (!topic.trim()) return;
    router.push(`/learn?topic=${encodeURIComponent(topic.trim())}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-edge-subtle px-4 sm:px-8 py-4 safe-area-top">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-base sm:text-lg font-semibold tracking-tight text-content-primary">
              ahura
            </span>
          </div>
          <span className="text-xs text-content-tertiary">
            Adaptive Learning Platform
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-4 sm:px-8 py-10 sm:py-16">
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <div className="max-w-2xl mb-12 sm:mb-16">
            <h1 className="text-2xl sm:text-3xl font-semibold text-content-primary mb-3 leading-tight">
              Workforce development that adapts to how you learn
            </h1>
            <p className="text-sm sm:text-base text-content-secondary leading-relaxed">
              AI-powered training with real-time comprehension monitoring.
              Our platform detects when you&apos;re struggling and adjusts the
              material — so every minute of training counts.
            </p>
          </div>

          {/* Search */}
          <div className="mb-10 sm:mb-14">
            <label className="block text-xs font-medium text-content-secondary mb-2 uppercase tracking-wider">
              Start a learning session
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && startLearning(customTopic)
                }
                placeholder="Enter a topic, skill, or competency..."
                className="flex-1 bg-surface-card border border-edge-subtle rounded-lg px-4 py-2.5 text-sm text-content-primary placeholder-content-tertiary focus:outline-none focus:border-accent transition-colors"
              />
              <button
                onClick={() => startLearning(customTopic)}
                disabled={!customTopic.trim()}
                className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:bg-surface-elevated disabled:text-content-tertiary text-white text-sm font-medium rounded-lg transition-colors"
              >
                Begin
              </button>
            </div>
          </div>

          {/* Course catalog */}
          <div>
            <h2 className="text-xs font-medium text-content-secondary mb-4 uppercase tracking-wider">
              Course catalog
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-edge-subtle rounded-lg overflow-hidden">
              {COURSES.map((course) => (
                <button
                  key={course.title}
                  onClick={() => startLearning(course.title)}
                  className="text-left p-5 bg-surface-card hover:bg-surface-elevated transition-colors"
                >
                  <span
                    className={`inline-block text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded mb-3 ${
                      CATEGORY_COLORS[course.category] || "text-content-secondary bg-surface-elevated"
                    }`}
                  >
                    {course.category}
                  </span>
                  <h3 className="text-sm font-medium text-content-primary mb-1">
                    {course.title}
                  </h3>
                  <p className="text-xs text-content-tertiary leading-relaxed">
                    {course.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Capabilities */}
          <div className="mt-14 sm:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            {[
              {
                title: "Comprehension monitoring",
                desc: "Webcam-based facial analysis detects confusion, engagement, and frustration in real time. All processing stays local on your device.",
              },
              {
                title: "Adaptive content delivery",
                desc: "When comprehension drops, the system automatically adjusts difficulty, rephrases concepts, and provides targeted reinforcement.",
              },
              {
                title: "Session analytics",
                desc: "Track engagement trends, identify knowledge gaps, and measure training effectiveness across your learning sessions.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="text-sm font-medium text-content-primary mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-content-tertiary leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-edge-subtle px-4 sm:px-8 py-4 safe-area-bottom">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-content-tertiary">
          <span>Ahura AI</span>
          <span>
            Emotion processing runs locally. No video data leaves your device.
          </span>
        </div>
      </footer>
    </div>
  );
}
