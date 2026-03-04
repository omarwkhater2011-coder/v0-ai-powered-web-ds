import { generateText } from "ai"

const SYSTEM_PROMPTS: Record<string, string> = {
  summarize:
    "You are an academic assistant. Summarize the following text concisely, keeping the most important points. Use clear, student-friendly language. Output only the summary.",
  simplify:
    "You are an academic assistant. Rewrite the following text in simpler language that a first-year student could understand. Keep the meaning intact but use everyday words. Output only the simplified text.",
  explain:
    "You are an academic assistant. Provide a detailed explanation of the following text. Break down complex concepts, give examples where helpful, and ensure a student can fully understand it. Output only the explanation.",
  quiz:
    "You are an academic assistant. Based on the following text, generate 3-5 short quiz questions with answers. Format each as:\nQ: [question]\nA: [answer]\n\nOutput only the quiz questions and answers.",
}

export async function POST(req: Request) {
  try {
    const { text, action } = await req.json()

    if (!text || typeof text !== "string" || !text.trim()) {
      return Response.json({ result: "No text provided." }, { status: 400 })
    }

    const systemPrompt = SYSTEM_PROMPTS[action]
    if (!systemPrompt) {
      return Response.json(
        { result: "Invalid action. Use: summarize, simplify, explain, or quiz." },
        { status: 400 }
      )
    }

    const { text: result } = await generateText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      prompt: text,
      maxTokens: 2000,
      temperature: 0.4,
    })

    return Response.json({ result })
  } catch (error) {
    console.error("AI Notes API error:", error)
    return Response.json(
      { result: "Something went wrong processing your request. Please try again." },
      { status: 500 }
    )
  }
}
