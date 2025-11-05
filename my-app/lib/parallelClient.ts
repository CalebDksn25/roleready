export interface ParallelRequest {
  preset?: "interview" | "company" | string;
  prompt?: string;
  resume_text?: string;
  job_description?: string;
  role?: string;
  company_name?: string;
  domain?: string;
  lookback_days?: number;
  max_cost_usd?: number;
  timeout_ms?: number;
  [key: string]: any; // allow flexibility
}

export interface ParallelResponse {
  output_text?: string;
  [key: string]: any;
}

const PARALLEL_API_URL = "https://api.parallelai.xyz/v1/run";

export const parallelClient = {
  async run(payload: ParallelRequest): Promise<ParallelResponse> {
    try {
      const response = await fetch(PARALLEL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PARALLEL_API_KEY ?? ""}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Parallel API ${response.status}: ${text}`);
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error("ParallelClient Error:", err);
      return { output_text: `Error: ${err.message}` };
    }
  },
};
