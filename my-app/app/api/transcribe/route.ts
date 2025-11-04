import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  //Read the session cookie from the request
  let sessionId = req.cookies.get("aii_session")?.value ?? undefined;
  if (!sessionId) sessionId = randomUUID();

  //Get the data from the form
  const formData = await req.formData();
  const question_id = formData.get("question_id") as string;
  const question = formData.get("question") as string;

  //Create openai client
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  //Read audio file from the form data, which contains the transcription
  const audioFile = formData.get("audio") as Blob;
  const trans = await client.audio.transcriptions.create({
    file: audioFile,
    model: "gpt-4o-transcribe",
    response_format: "text",
  });

  // Try to upload the data to supabase table "transcriptions"
  try {
    const supa = supabaseAdmin();
    const { error } = await supa.from("question_and_answer").insert({
      session_id: sessionId,
      question_id: question_id,
      question: question,
      answer_trans: trans,
    });
    //Check if there was an error inserting into supabase
    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
    } else {
      //Return success response after inserting to supabase
      return NextResponse.json({ ok: true });
    }
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
