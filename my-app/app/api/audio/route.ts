import { NextRequest } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text =
    searchParams.get("text") ||
    "Hello from your AI Interviewer! I am working properly, just missing some data.";

  const response = (await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    input: text,
    //format: "mp3" as any,
  })) as any;

  const body = response.body ?? response;

  return new Response(body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
