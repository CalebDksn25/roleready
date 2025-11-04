import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
//import fs from "fs";
//import path from "path";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type StartInterviewBody = {
  candidateId?: string;
};

export async function POST(req: NextRequest) {
  try {
    /*const { candidateId }: StartInterviewBody = await req
      .json()
      .catch(() => ({}));
    */
    const sessionId = req.cookies.get("aii_session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session id." },
        { status: 400 }
      );
    }

    const supa = supabaseAdmin();

    //Pull the most recent resume, and verify with the session id
    const query = supa
      .from("documents")
      .select("content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(4);

    //console.log("Supabase Query:", query);

    //if (candidateId) query.eq("candidate_id", candidateId);
    if (sessionId) query.eq("session_id", sessionId);

    const { data, error } = await query;
    if (error) {
      console.error("Supabase Fetch Error", error);
      return NextResponse.json(
        { error: "Failed to fetch resume data" },
        { status: 500 }
      );
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "No resume content found for this session" },
        { status: 404 }
      );
    }

    const resumeContent = data
      .map((d) => d.content ?? "")
      .join("\n\n")
      .slice(0, 6000);

    console.log("Data fetched from Supabase:", data);
    //console.log("Resume Content:", resumeContent);

    //Provide System information for OpenAI call
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const sys = [
      "You are an AI interviewer for a university tech club.",
      "Your job: read the provided resume summary and produce exactly 5 interview questions.",
      "Make them tailored specifically to the resume that has been uploaded, specific, and actionable.",
      "Prefer open-ended prompts that probe skills, decisions, impact, and trade-offs.",
      "Avoid yes/no questions. No fluff. No salutations. No explanations.",
    ].join(" ");

    const user = [
      "Resume summary below:\n",
      "----- RESUME START -----\n",
      resumeContent,
      "\n----- RESUME END -----\n",
      'Return JSON with shape: { "questions": ["Q1", "Q2", "Q3", "Q4", "Q5"] }',
      "Only produce valid JSON.",
    ].join("");

    //Call open AI with provided information
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    });

    //Parse JSON response from OPENAI
    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed: { questions?: string[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { questions: [] };
    }

    // Final guard: ensure 5 strings
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.filter((q) => typeof q === "string").slice(0, 5)
      : [];

    if (questions.length !== 5) {
      return NextResponse.json(
        { error: "Model did not return 5 questions.", raw },
        { status: 502 }
      );
    }

    //Return Questions
    return NextResponse.json({ questions });

    //Catch Errors
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown Error Occured" },
      { status: 500 }
    );
  }
}
