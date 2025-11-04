import { NextResponse, NextRequest } from "next/server";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  //Get the session id via cookie requests
  let sessionId = req.cookies.get("aii_session")?.value ?? undefined;
  if (!sessionId) sessionId = randomUUID();

  //Set the system prompt for GPT to give feedback on the answer and question provided
  const systemPrompt = `You are an AI Interview Evaluator. 
Your job is to analyze a candidate’s interview performance.

You will be given:
- The INTERVIEW QUESTION asked.
- The USER ANSWER (transcribed text).

Your tasks:
1. Rate the answer’s quality on a scale of 1 to 5.
   - 1 = very poor / incomplete
   - 5 = excellent / well-structured
2. Highlight the answer’s **strengths** (good points, relevant examples, clarity, technical depth, etc.).
3. Point out **weaknesses** (gaps, vagueness, missing structure, irrelevant info).
4. Provide **constructive feedback** in plain language to help the candidate improve next time.

You must output a valid JSON object in this schema:

{
  "score": number (1–5),
  "strengths": [ "bullet point", "bullet point" ],
  "weaknesses": [ "bullet point", "bullet point" ],
  "feedback": "one short paragraph of helpful feedback"
}

DO NOT include anything outside of the JSON object.
DO NOT use markdown formatting.`;

  //Declare questionasked and userresponse variables
  let questionasked: string | null = null;
  let userresponse: string | null = null;

  //Get the question from supabase via session and most resent upload
  try {
    const supa = supabaseAdmin();
    const query = supa
      .from("question_and_answer")
      .select("question, answer_trans")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data, error } = await query;
    if (error) {
      console.error("Supabase Fetch Error", error);
      return NextResponse.json(
        { error: "Failed to fetch question data" },
        { status: 500 }
      );
    }

    const row = data?.[0];
    questionasked = row?.question ?? null;
    userresponse = row?.answer_trans ?? null;

    console.log(
      "Fetched question and answer form supabase: ",
      questionasked,
      userresponse
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  //Use open ai to proccess the feedback and return JSON response
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `QUESTION: ${questionasked} , ANSWER: ${userresponse}`,
        },
      ],
    });

    console.log("OpenAI feedback response: ", response);

    return NextResponse.json(response);
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
