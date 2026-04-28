import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireCredits } from "@/lib/require-credits";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function POST(req: NextRequest) {
  try {
    // ── Credit gate — blocks if no credits ──
    const gate = await requireCredits();
    if (gate.error) return gate.error;

    const { image, question } = await req.json();

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY is missing in .env.local" }, { status: 500 });
    }

    if (!image || !question) {
      return NextResponse.json({ error: "image and question are required" }, { status: 400 });
    }

    const response = await client.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || "openrouter/free",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: question },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      max_tokens: 300,
    });

    return NextResponse.json({
      answer: response.choices?.[0]?.message?.content || "No answer returned.",
    });
  } catch (error: any) {
    console.error("Multimodal error:", error?.message || error);
    return NextResponse.json(
      { error: error?.error?.message || error?.message || "Multimodal request failed" },
      { status: 500 }
    );
  }
}