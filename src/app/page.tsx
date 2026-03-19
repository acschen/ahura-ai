"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SUGGESTED_TOPICS = [
  {
    title: "Machine Learning Fundamentals",
    description: "Neural networks, gradient descent, and model training",
    icon: "🧠",
  },
  {
    title: "Quantum Computing",
    description: "Qubits, superposition, and quantum algorithms",
    icon: "⚛️",
  },
  {
    title: "Blockchain & Web3",
    description: "Distributed ledgers, smart contracts, and DeFi",
    icon: "🔗",
  },
  {
    title: "Cybersecurity Essentials",
    description: "Threat models, encryption, and defense strategies",
    icon: "🔒",
  },
  {
    title: "Product Management",
    description: "Strategy, roadmaps, and stakeholder management",
    icon: "📊",
  },
  {
    title: "Cloud Architecture",
    description: "AWS, microservices, and distributed systems",
    icon: "☁️",
  },
];

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
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-lg">
              A
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Ahura AI</h1>
              <p className="text-xs text-gray-500">
                Emotion-Aware Learning
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            AI Tutor Ready
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-3xl w-full text-center mb-12 animate-slide-up">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Learn with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              Emotional Intelligence
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-xl mx-auto">
            Our AI tutor watches your facial expressions to detect confusion,
            engagement, and frustration — adapting lessons in real-time for
            optimal learning.
          </p>
        </div>

        {/* Custom topic input */}
        <div className="w-full max-w-xl mb-10 animate-slide-up">
          <div className="flex gap-3">
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startLearning(customTopic)}
              placeholder="What do you want to learn today?"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-5 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <button
              onClick={() => startLearning(customTopic)}
              disabled={!customTopic.trim()}
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-colors"
            >
              Start Learning
            </button>
          </div>
        </div>

        {/* Suggested topics */}
        <div className="w-full max-w-3xl">
          <p className="text-sm text-gray-500 mb-4 text-center">
            Or choose a topic to get started
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SUGGESTED_TOPICS.map((topic) => (
              <button
                key={topic.title}
                onClick={() => startLearning(topic.title)}
                className="text-left p-4 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-indigo-500/50 hover:bg-gray-900 transition-all group"
              >
                <div className="text-2xl mb-2">{topic.icon}</div>
                <h3 className="font-medium text-white group-hover:text-indigo-300 transition-colors text-sm">
                  {topic.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {topic.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="w-full max-w-3xl mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "Real-Time Detection",
              desc: "Webcam analyzes facial expressions to detect your learning state",
              color: "from-green-500 to-emerald-600",
            },
            {
              title: "Adaptive Teaching",
              desc: "AI tutor adjusts difficulty and approach based on your emotions",
              color: "from-indigo-500 to-blue-600",
            },
            {
              title: "Learning Dashboard",
              desc: "Live visualization of your emotional journey through the material",
              color: "from-purple-500 to-pink-600",
            },
          ].map((feature) => (
            <div key={feature.title} className="text-center">
              <div
                className={`w-12 h-12 rounded-full bg-gradient-to-br ${feature.color} mx-auto mb-3 flex items-center justify-center`}
              >
                <div className="w-3 h-3 bg-white rounded-full" />
              </div>
              <h4 className="font-medium text-white text-sm mb-1">
                {feature.title}
              </h4>
              <p className="text-xs text-gray-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-4 text-center text-xs text-gray-600">
        Ahura AI — Learn today. Lead tomorrow. All emotion processing happens
        locally in your browser.
      </footer>
    </div>
  );
}
