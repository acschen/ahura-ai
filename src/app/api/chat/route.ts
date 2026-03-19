import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  const { topic, messages, learningState, engagementScore } = await req.json();

  const systemPrompt = buildSystemPrompt(topic, learningState, engagementScore);

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
            encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
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
  engagementScore?: number
): string {
  let adaptiveInstructions = "";

  if (learningState) {
    switch (learningState) {
      case "confused":
        adaptiveInstructions = `
IMPORTANT: The learner appears CONFUSED right now. Adapt your teaching:
- Break the concept into smaller, simpler steps
- Use analogies and real-world examples
- Ask a simple check-in question to verify understanding
- Avoid introducing new complexity until confusion resolves
- Use encouraging language`;
        break;
      case "frustrated":
        adaptiveInstructions = `
IMPORTANT: The learner appears FRUSTRATED. Adapt your teaching:
- Acknowledge the difficulty of the material
- Dramatically simplify your explanation
- Use a completely different angle or analogy
- Give a quick win — something easy they can succeed at
- Be warm and encouraging`;
        break;
      case "bored":
        adaptiveInstructions = `
IMPORTANT: The learner appears BORED or disengaged. Adapt your teaching:
- Increase the challenge and complexity
- Present a surprising fact or counterintuitive example
- Ask a thought-provoking question
- Connect the topic to something practical and exciting
- Make it interactive — pose a challenge or puzzle`;
        break;
      case "delighted":
        adaptiveInstructions = `
The learner is DELIGHTED and experiencing a breakthrough moment:
- Build on this momentum — introduce the next concept
- Slightly increase difficulty while they're in flow
- Reinforce what they just understood
- Keep the energy going`;
        break;
      case "engaged":
        adaptiveInstructions = `
The learner is engaged and following well:
- Continue at the current pace and difficulty
- Maintain your teaching approach
- Gradually introduce more depth`;
        break;
    }
  }

  return `You are an expert AI tutor for Ahura AI, an adaptive learning platform. You are teaching the learner about: "${topic}".

Your teaching approach:
1. Start with a clear, structured lesson on the topic
2. Use markdown formatting for clear structure (headers, bullet points, code blocks when relevant)
3. Break complex topics into digestible sections
4. Use real-world analogies and examples
5. After explaining a concept, ask the learner questions to check understanding
6. Adapt your difficulty based on their responses
7. Use the Socratic method — guide them to discover answers

When the learner first starts, introduce the topic and begin with the fundamentals. Structure your initial response as a lesson with clear sections.

For follow-up messages, continue building on what was taught. If they ask questions, answer them thoroughly. If they answer your questions, provide feedback and move forward.

${adaptiveInstructions}

${engagementScore !== undefined ? `Current engagement score: ${engagementScore}/100` : ""}

Keep responses focused and educational. Use markdown headers (##) to structure sections. Keep individual responses under 500 words unless teaching a complex concept that requires more detail.`;
}
