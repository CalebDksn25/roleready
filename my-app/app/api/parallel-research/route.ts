import { NextResponse, NextRequest } from "next/server";
import { questionSearch } from "./question-search/search";
import { companySearch } from "./company-search/search";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const systemPrompt = `
You are an interviewing-prep analyst.

Only use the provided inputs: resume_text, job_description (optional),
evidence[] (Parallel search results), and company_insights (optional).
Do NOT fetch data or use external tools.

Return ONE valid JSON object ONLY.
- No code fences
- No Markdown
- No extra text or commentary

The JSON must include:
- "what_to_expect": { summary, rounds[], topic_weights[], timeline_hint, difficulty, confidence (0..1), source_ids[] }
- "top_questions": exactly 5 items, each with { question, category, rationale, how_to_prepare[], predicted_difficulty, evaluation_criteria[], source_ids[] }
- "company_insights_out": { one_liner, products[], tech_stack[], recent_news_or_ships[], culture_themes[], role_specific_context, reading_list[{title,url,source_id|null}], confidence (0..1), source_ids[] }

Rules:
- Cite evidence by filling source_ids with IDs from the evidence array when available.
- If a field lacks support, use "unknown" or "insufficient_evidence".
- Be concise and factual.
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    //Start all of the parallel searches
    const [companyData, questionData] = await Promise.all([
      companySearch(body),
      questionSearch(body),
    ]);

    //Combine results to pass to claude
    const allData = {
      original_request: body,
      company: companyData,
      questions: questionData,
    };

    //Call OpenAI to summarize and analyze
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content:
            "Analyze the following data to help prepare for an interview.",
        },
      ],
      max_tokens: 800,
      temperature: 0.5,
    });

    //Return the response
    return NextResponse.json({
      summary: response.choices[0].message?.content ?? "",
    });
  } catch (error: any) {
    console.error("Error in the Parallel to OPEN AI Research call: ", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error Occured" },
      { status: 500 }
    );
  }
}
