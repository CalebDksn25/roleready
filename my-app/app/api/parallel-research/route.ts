import { NextResponse, NextRequest } from "next/server";
import { questionSearch } from "./question-search/search";
import { companySearch } from "./company-search/search";
import { interviewerSearch } from "./interviewer-search/search";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const systemPrompt = `
You are an interview-preparation analyst.

You will receive a JSON object from the user containing:
- company: results from companySearch()
- questions: results from questionSearch()
- interviewer: results from interviewerSearch()

Each of these contains:
- evidence[]: an array of search result items, each with:
  { id, type, title, url, raw }

Use ONLY this provided data.  
Do NOT fetch external information, guess missing details, or infer facts not supported by evidence.  
If information is missing, use "unknown" or "insufficient_evidence".

Keep all outputs concise (1–2 sentences per text field).

You must return ONE valid JSON object ONLY:
- No code fences
- No Markdown
- No extra commentary

The JSON must include the following top-level keys:

1. "what_to_expect": {
      summary,
      rounds[],
      topic_weights[],            // [{ topic, weight }]
      timeline_hint,
      difficulty,
      confidence (0..1),
      source_ids[]                // MUST come ONLY from questions.evidence
   }

2. "top_questions": exactly 5 items, each:
   {
      question,
      category,
      rationale,
      how_to_prepare[],
      predicted_difficulty,
      evaluation_criteria[],
      source_ids[]                // MUST come ONLY from questions.evidence
   }

3. "company_insights_out": {
      one_liner,
      products[],
      tech_stack[],
      recent_news_or_ships[],
      culture_themes[],
      role_specific_context,
      reading_list[ { title, url, source_id|null } ],
      confidence (0..1),
      source_ids[]                // MUST come ONLY from company.evidence
   }

4. "questions_for_interviewer": {
      summary,
      items: [
        {
          question,
          why_it_matters,
          suggested_follow_ups[],
          personalization,
          source_ids[]             // MUST come ONLY from interviewer.evidence (e.g., "person-0")
        }
      ],
      confidence (0..1)
   }

Citation Rules:
- When citing evidence, ALWAYS use the id from the appropriate evidence array.
- DO NOT mix sources:
  * what_to_expect → questions.evidence ONLY
  * top_questions → questions.evidence ONLY
  * company_insights_out → company.evidence ONLY
  * questions_for_interviewer → interviewer.evidence ONLY
- If there is insufficient data to personalize something, clearly state "insufficient_evidence" and set confidence low (e.g., 0.2–0.4).

Return ONLY the final JSON object.
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // If a job link was provided, attempt to heuristically extract company and role
    // so downstream searches (companySearch, questionSearch) can run.
    try {
      const jobLink = body.job_link || body.jobURL || body.jobLink;
      if (jobLink) {
        try {
          const url = new URL(jobLink);
          const host = url.hostname || "";
          const path = url.pathname || "";

          // Heuristic company extraction:
          // - For hosts like `lplfinancial.wd1.myworkdayjobs.com` -> use first subdomain `lplfinancial`
          // - Otherwise, try the first label (often useful for company-specific career pages)
          const hostParts = host.split(".").filter(Boolean);
          let companyCandidate = "";
          if (hostParts.length >= 3) {
            companyCandidate = hostParts[0];
          } else if (hostParts.length === 2) {
            companyCandidate = hostParts[0];
          }
          companyCandidate = (companyCandidate || "")
            .replace(/[-_]/g, " ")
            .trim();

          // Role extraction: use the last meaningful path segment
          const segments = path.split("/").filter(Boolean);
          let roleCandidate = segments.length
            ? segments[segments.length - 1]
            : "";
          roleCandidate = decodeURIComponent(roleCandidate || "");
          // Remove trailing ids like `_R-046201` or `_\d+` or `-R-12345`
          roleCandidate = roleCandidate.replace(/[_-]R?-?\d+$/i, "");
          // Replace non-alphanumeric separators with spaces
          roleCandidate = roleCandidate.replace(/[^a-zA-Z0-9]+/g, " ").trim();

          if (!body.company && companyCandidate)
            body.company = companyCandidate;
          if (!body.role && roleCandidate) body.role = roleCandidate;
        } catch (err) {
          // ignore parsing errors and continue
        }
      }
    } catch (err) {
      // ignore errors
    }

    // If required inputs are missing, return the example output so the UI
    // can display meaningful demo data (helps during dev / missing fields).
    // The example.json lives next to this route.
    const hasCompany = !!(
      body.company ||
      body.company_name ||
      body.job_link ||
      body.jobURL
    );
    const hasRole = !!(body.role || body.job_title || body.jobRole);
    const hasInterviewer = !!body.interviewer_linkedin_url;

    if (!hasCompany || !hasRole || !hasInterviewer) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const example = require("./example.json");
        return NextResponse.json(example);
      } catch (err) {
        console.warn("Could not load example.json fallback", err);
        // fall through to attempt normal processing and surface the error
      }
    }

    //Start all of the parallel searches
    const [companyData, questionData, interviewerData] = await Promise.all([
      companySearch(body),
      questionSearch(body),
      interviewerSearch(body),
    ]);

    //Combine results to pass to claude
    const allData = {
      company: companyData,
      questions: questionData,
      interviewer: interviewerData,
    };

    //console.log(allData);

    //Call OpenAI to summarize and analyze
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            "Analyze the following data to help prepare for an interview:\n\n" +
            JSON.stringify(allData),
        },
      ],
      max_tokens: 1600,
      temperature: 0.9,
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
