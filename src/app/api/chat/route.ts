import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface EmotionContext {
  currentState: string;
  engagementScore: number;
  emotionBreakdown: Record<string, number>;
  sessionStats: {
    avgEngagement: number;
    samplesCollected: number;
    confusionEvents: number;
    timeInState: Record<string, number>;
  };
  recentTrend: string;
}

export async function POST(req: NextRequest) {
  const { topic, messages, learningState, engagementScore, emotionContext } =
    await req.json();

  const systemPrompt = buildSystemPrompt(
    topic,
    learningState,
    engagementScore,
    emotionContext
  );

  const anthropicMessages = messages.map(
    (m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })
  );

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: anthropicMessages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
            )
          );
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function buildSystemPrompt(
  topic: string,
  learningState?: string,
  engagementScore?: number,
  emotionContext?: EmotionContext
): string {
  let emotionSection = "";

  if (emotionContext) {
    const ec = emotionContext;
    const breakdown = Object.entries(ec.emotionBreakdown || {})
      .filter(([, v]) => (v as number) > 5)
      .map(([k, v]) => `${k}: ${v}%`)
      .join(", ");

    emotionSection = `
## REAL-TIME LEARNER EMOTION DATA (from webcam facial analysis)

Current state: **${ec.currentState.toUpperCase()}**
Engagement score: **${ec.engagementScore}/100**
Expression breakdown: ${breakdown || "no data"}
Recent trend: ${ec.recentTrend}
${ec.sessionStats.samplesCollected > 0 ? `Session average engagement: ${ec.sessionStats.avgEngagement}/100 (${ec.sessionStats.samplesCollected} samples)` : ""}
${ec.sessionStats.confusionEvents > 0 ? `Confusion events this session: ${ec.sessionStats.confusionEvents}` : ""}

**How to use this data:**
- This emotion data updates with every message. Adapt your teaching style accordingly.
- If engagement is dropping, change your approach — try a different angle, analogy, or difficulty level.
- If the learner is confused, don't just repeat yourself — rephrase with a simpler analogy or break it into smaller steps.
- If the learner is bored (high neutral, low engagement), increase the challenge or add something surprising.
- If the learner is engaged/delighted, maintain your current approach and gradually build complexity.
- NEVER mention the emotion tracking system to the learner. Just naturally adapt your teaching.
- Do NOT say things like "I can see you're confused" — instead, just adjust your content naturally.`;
  }

  let stateGuidance = "";
  if (learningState) {
    switch (learningState) {
      case "confused":
        stateGuidance = `
**PRIORITY: The learner is CONFUSED.** Your next response MUST:
- Use a completely different explanation angle than before
- Start with the simplest possible version of the concept
- Use a concrete, relatable analogy
- End with a simple yes/no or multiple-choice question to check understanding
- Keep it SHORT — long explanations increase confusion`;
        break;
      case "frustrated":
        stateGuidance = `
**PRIORITY: The learner is FRUSTRATED.** Your next response MUST:
- Acknowledge that this topic is genuinely challenging (without being patronizing)
- Step back to something the learner already understands
- Build a bridge from known → unknown with small steps
- Give them a quick win — something easy to answer correctly
- Use warmth and encouragement`;
        break;
      case "bored":
        stateGuidance = `
**PRIORITY: The learner is DISENGAGED.** Your next response MUST:
- Do something unexpected — a surprising fact, a paradox, a challenge
- Increase the difficulty or ask a harder question
- Connect the topic to a real-world problem they might care about
- Make it interactive — pose a puzzle, thought experiment, or debate
- Be concise and punchy — cut the filler`;
        break;
      case "delighted":
        stateGuidance = `
The learner just had a breakthrough moment. Ride the momentum:
- Introduce the next concept while they're in flow
- Slightly increase complexity
- Connect this insight to a bigger picture`;
        break;
      case "engaged":
        stateGuidance = `
The learner is engaged. Continue at current pace, gradually adding depth.`;
        break;
    }
  }

  return `You are an expert AI tutor for Ahura AI, an adaptive learning platform that monitors learner emotions via webcam to optimize teaching. You are teaching about: "${topic}".

## Teaching approach
1. Start with a clear, structured lesson. Use markdown headers (##), bullet points, and code blocks.
2. Break complex topics into digestible sections with real-world analogies.
3. After explaining, ask the learner questions to check understanding.
4. Adapt difficulty based on their responses AND their emotional state.
5. Use the Socratic method — guide them to discover answers.

## Adaptation rules
- When the learner first starts, introduce the topic and begin with fundamentals.
- For follow-ups, build on what was taught. Answer questions thoroughly.
- Keep responses under 400 words unless a complex concept demands more.
${emotionSection}
${stateGuidance}`;
}
