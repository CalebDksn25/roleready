"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

// Progress Bar Component
function ProgressBar({
  progress,
  message,
}: {
  progress: number;
  message: string;
}) {
  if (progress === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mb-6">
      <div className="text-sm text-gray-400 mb-2 font-medium">{message}</div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [parsedText, setParsedText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "waiting" | "uploading" | "success" | "error"
  >("waiting");
  const [interviewStatus, setInterviewStatus] = useState("");
  const [interviewStatusType, setInterviewStatusType] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [interviewQuestions, setInterviewQuestions] = useState<string[] | null>(
    null
  );
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [microphoneSrc, setMicrophoneSrc] = useState<string | null>(null);
  const [recordAllowed, setRecordAllowed] = useState<boolean>(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const [recording, setRecording] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recievedResume, setRecievedResume] = useState<boolean>(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [hasAnswer, setHasAnswer] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<any | null>(null);

  // Progress tracking for API calls
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  React.useEffect(() => {
    if (interviewQuestions?.length) {
      setCurrentQuestion(0);
      setHasAnswer(false);
    }
  }, [interviewQuestions]);

  //nextQuestion function to move to the next interview question
  async function nextQuestion() {
    setCurrentQuestion((i) =>
      Math.min((interviewQuestions?.length ?? 1) - 1, i + 1)
    );
    setAnswerFeedback(null);
  }

  //previousQuestion function to move to the previous interview question
  async function previousQuestion() {
    setCurrentQuestion((i) => Math.max(0, i - 1));
    setAnswerFeedback(null);
  }

  //resetQuestions function to reset the inverview questions
  async function resetQuestions() {
    setCurrentQuestion(0);
  }

  //Build TTS for only the current question
  React.useEffect(() => {
    if (interviewQuestions?.length) {
      const text = interviewQuestions[currentQuestion] ?? "";
      if (text) {
        setAudioSrc("/api/audio?text=" + encodeURIComponent(text));
      }
      setIsTtsPlaying(!!text);
      setHasAnswer(false);
      setAnswerFeedback(null);
    } else {
      setAudioSrc(null);
    }
  }, [currentQuestion, interviewQuestions]);

  //onSubmit function to upload resume
  async function uploadSubmit(e: React.FormEvent<HTMLFormElement>) {
    setRecievedResume(true);
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setUploadStatus("uploading");
    setStatus("Uploading & embedding…");
    setProgress(10);
    setProgressMessage("Preparing file...");

    try {
      setProgress(30);
      setProgressMessage("Uploading resume...");
      const r = await fetch("/api/upload", { method: "POST", body: fd });

      setProgress(70);
      setProgressMessage("Processing & embedding...");
      const j = await r.json();

      if (r.ok) {
        setProgress(100);
        setProgressMessage("Resume processed successfully!");
        setStatus(`Successfully Embedded ${j.chunkCount} chunks`);
        setParsedText(j.parsedText ?? null);
        setFileName(j.fileName ?? null);
        setCandidateId(j.candidateId ?? null);
        setUploadStatus("success");
        setTimeout(() => {
          setProgress(0);
          setProgressMessage("");
        }, 2000);
      } else {
        setProgress(0);
        setStatus(`Failed embedd, ${await r.text()}`);
        setParsedText(null);
        setFileName(null);
        setCandidateId(null);
        setUploadStatus("error");
      }
    } catch (err) {
      setProgress(0);
      setUploadStatus("error");
      setStatus("Upload failed");
    }
  }

  //startInterview function to generate questions
  async function startInterview(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setInterviewStatus("Starting interview");
    setInterviewStatusType("loading");
    setProgress(10);
    setProgressMessage("Preparing interview...");

    if (recievedResume === false) {
      setInterviewStatus("Please upload a resume first");
      setInterviewStatusType("error");
      setProgress(0);
      return;
    }

    try {
      setProgress(30);
      setProgressMessage("Generating personalized questions...");
      const r = await fetch("/api/start-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      setProgress(70);
      setProgressMessage("Finalizing interview setup...");
      const j = await r.json();

      if (r.ok) {
        setProgress(100);
        setProgressMessage("Interview ready!");
        setInterviewStatus("Successfully created questions");
        setInterviewStatusType("success");
        setInterviewQuestions(Array.isArray(j?.questions) ? j.questions : null);
        setTimeout(() => {
          setProgress(0);
          setProgressMessage("");
        }, 2000);
      } else {
        setProgress(0);
        setInterviewStatus("Failed to create questions");
        setInterviewStatusType("error");
        setInterviewQuestions(null);
      }
    } catch (err) {
      setProgress(0);
      setInterviewStatus("Failed to create questions");
      setInterviewStatusType("error");
    }
  }

  //Ensure the mic is working and can be used
  async function ensureMic() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordAllowed(true);
    } catch (e) {
      console.error("Microphone access denied");
      setRecordAllowed(false);
    }
  }

  //uploadAudioAndTranscribe function to upload the audio blob response for a specific question to supabase
  async function uploadAudioAndTranscribe(blob: Blob) {
    setInterviewStatus("Uploading audio for transcription…");
    setInterviewStatusType("loading");
    setProgress(10);
    setProgressMessage("Preparing audio...");

    const fd = new FormData();
    fd.append("audio", blob);
    fd.append("question_id", String(currentQuestion));
    fd.append(
      "question",
      interviewQuestions ? interviewQuestions[currentQuestion] : ""
    );

    try {
      setProgress(30);
      setProgressMessage("Uploading audio...");
      const r = await fetch("/api/transcribe", {
        method: "POST",
        body: fd,
      });

      setProgress(60);
      setProgressMessage("Transcribing audio...");

      if (r.ok) {
        setProgress(90);
        setProgressMessage("Processing transcription...");
        const j = await r.json();
        setProgress(100);
        setProgressMessage("Transcription complete!");
        setInterviewStatus("Audio transcribed successfully");
        setInterviewStatusType("success");
        setTimeout(() => {
          setProgress(0);
          setProgressMessage("");
        }, 1500);
      } else {
        setProgress(0);
        setInterviewStatus("Failed to transcribe audio");
        setInterviewStatusType("error");
      }
    } catch (err) {
      setProgress(0);
      setInterviewStatus("Failed to transcribe audio");
      setInterviewStatusType("error");
    }
  }

  //Get feed back on the last answer given
  async function getAnswerFeedback() {
    setInterviewStatus("Getting feedback on your answer...");
    setInterviewStatusType("loading");
    setProgress(10);
    setProgressMessage("Analyzing your answer...");

    try {
      setProgress(40);
      setProgressMessage("Evaluating response quality...");
      const r = await fetch("/api/ans-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      setProgress(70);
      setProgressMessage("Generating detailed feedback...");

      if (r.ok) {
        const j = await r.json();
        const payload = j.output_text ?? j;
        let parsed: any = payload;
        try {
          if (typeof payload === "string") parsed = JSON.parse(payload);
        } catch (e) {
          parsed = payload;
        }

        setProgress(100);
        setProgressMessage("Feedback ready!");
        setInterviewStatus("Received feedback successfully");
        setInterviewStatusType("success");
        console.log("Answer feedback: ", parsed);
        setAnswerFeedback(parsed);
        setTimeout(() => {
          setProgress(0);
          setProgressMessage("");
        }, 1500);
        return parsed;
      } else {
        setProgress(0);
        setInterviewStatus("Failed to get feedback");
        setInterviewStatusType("error");
      }
    } catch (err) {
      setProgress(0);
      setInterviewStatus("Failed to get feedback");
      setInterviewStatusType("error");
    }
  }

  //Start recording function to intake the audio from mic
  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordAllowed(true);

      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options.mimeType = "audio/webm";
      }

      const mr = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type ?? "audio/webm",
        });
        try {
          await uploadAudioAndTranscribe(blob);
        } catch (e: any) {
          setError(e?.message ?? "Upload/transcribe failed");
        } finally {
          stream.getTracks().forEach((t) => t.stop());
          mediaRecorderRef.current = null;
          await getAnswerFeedback();
        }
      };

      mr.start();
      setRecording(true);
    } catch (e) {
      setError("Could not access microphone: " + (e ?? e));
      setRecordAllowed(false);
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-12 bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2 mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
            Role Ready AI
          </h1>
          <p className="text-gray-400 text-lg">Prepare for your dream job</p>
        </div>

        {/* Quick Start Interview Section */}
        <div className="glass glass-hover p-8 space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold text-white">
              Have an interview booked? Click here to get started
            </h2>
            <p className="text-gray-400">
              Provide job details, interviewer information, and your resume for
              a personalized interview experience
            </p>
          </div>
          <button
            className="px-8 py-4 glass bg-white bg-opacity-20 hover:bg-opacity-30 text-white border border-white border-opacity-30 hover:border-opacity-50 font-semibold rounded-xl shadow-lg transition-all duration-200 text-lg"
            type="button"
            onClick={() => router.push("/interview")}>
            Begin Interview Setup
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>
          <span className="text-gray-500 text-sm">OR</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>
        </div>

        {/* Progress Bar */}
        <ProgressBar progress={progress} message={progressMessage} />

        {/* Upload Section */}
        <div className="glass glass-hover p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-white">
              Step 1: Upload Resume
            </h2>
            <p className="text-gray-400 text-sm">
              Upload your resume to get started
            </p>
          </div>

          <form onSubmit={uploadSubmit} className="space-y-4">
            <div className="space-y-4">
              <label className="block">
                <div className="glass p-4 rounded-xl cursor-pointer hover:bg-opacity-80 transition-all duration-200 border-2 border-dashed border-gray-600 hover:border-blue-500">
                  <input
                    type="file"
                    className="hidden"
                    name="resume"
                    accept="application/pdf"
                    required
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setFileName(file.name);
                    }}
                  />
                  <div className="text-center">
                    <div className="text-blue-400 text-sm font-medium mb-1">
                      {fileName ? fileName : "Choose PDF file"}
                    </div>
                    <div className="text-gray-500 text-xs">PDF files only</div>
                  </div>
                </div>
              </label>

              <button
                className="w-full px-6 py-4 glass bg-white bg-opacity-20 hover:bg-opacity-30 text-white border border-white border-opacity-30 hover:border-opacity-50 font-semibold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={uploadStatus === "uploading"}>
                {uploadStatus === "uploading"
                  ? "Uploading..."
                  : uploadStatus === "success"
                  ? "✓ Uploaded"
                  : "Upload Resume"}
              </button>
            </div>
          </form>

          {uploadStatus === "success" && (
            <div className="p-4 glass rounded-xl bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30">
              <p className="text-green-400 text-sm font-medium">{status}</p>
            </div>
          )}

          {uploadStatus === "error" && (
            <div className="p-4 glass rounded-xl bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30">
              <p className="text-red-400 text-sm font-medium">{status}</p>
            </div>
          )}
        </div>

        {/* Start Interview Section */}
        <div className="flex items-center justify-center">
          <button
            className="px-8 py-4 glass bg-white bg-opacity-20 hover:bg-opacity-30 text-white border border-white border-opacity-30 hover:border-opacity-50 font-semibold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            type="button"
            onClick={startInterview}
            disabled={
              uploadStatus !== "success" || interviewStatusType === "loading"
            }>
            {interviewStatusType === "loading"
              ? "Starting Interview..."
              : interviewStatusType === "success"
              ? "✓ Interview Ready"
              : "Start Interview"}
          </button>
        </div>

        {/* Interview Questions Section */}
        {interviewQuestions ? (
          <div className="glass glass-hover p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Interview Session
                </h2>
                <p className="text-gray-400 text-sm">
                  Question {currentQuestion + 1} of {interviewQuestions.length}
                </p>
              </div>
              <div
                className="h-2 bg-gray-800 rounded-full overflow-hidden"
                style={{ width: "200px" }}>
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                  style={{
                    width: `${
                      ((currentQuestion + 1) / interviewQuestions.length) * 100
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="glass p-6 rounded-xl bg-blue-500 bg-opacity-5 border border-blue-500 border-opacity-20">
              <p className="text-lg text-white leading-relaxed">
                {interviewQuestions[currentQuestion] ?? ""}
              </p>
            </div>

            {/* TTS Audio Player */}
            {audioSrc ? (
              <div className="glass p-4 rounded-xl">
                <audio
                  src={audioSrc}
                  controls
                  autoPlay
                  onPlay={() => setIsTtsPlaying(true)}
                  onEnded={() => setIsTtsPlaying(false)}
                  className="w-full"
                />
              </div>
            ) : null}

            {/* Recording Controls */}
            <div className="flex items-center gap-4 flex-wrap">
              <button
                className="px-6 py-3 glass glass-hover text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                type="button"
                onClick={previousQuestion}
                disabled={currentQuestion === 0}>
                ← Previous
              </button>

              {!recording ? (
                <button
                  className="px-8 py-3 glass bg-white bg-opacity-20 hover:bg-opacity-30 text-white border border-white border-opacity-30 hover:border-opacity-50 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg transition-all duration-200 flex items-center gap-2"
                  type="button"
                  onClick={startRecording}
                  disabled={isTtsPlaying}>
                  <span className="w-3 h-3 bg-white rounded-full"></span>
                  Start Recording
                </button>
              ) : (
                <button
                  className="px-8 py-3 glass bg-white bg-opacity-20 hover:bg-opacity-30 text-white border border-white border-opacity-30 hover:border-opacity-50 rounded-xl font-semibold shadow-lg transition-all duration-200 flex items-center gap-2 animate-pulse"
                  type="button"
                  onClick={() => {
                    mediaRecorderRef.current?.stop();
                    setRecording(false);
                    setHasAnswer(true);
                  }}>
                  <span className="w-3 h-3 bg-white rounded-full"></span>
                  Stop Recording
                </button>
              )}

              <button
                className="px-6 py-3 glass bg-white bg-opacity-20 hover:bg-opacity-30 text-white border border-white border-opacity-30 hover:border-opacity-50 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg transition-all duration-200"
                type="button"
                onClick={nextQuestion}
                disabled={
                  currentQuestion === interviewQuestions.length - 1 ||
                  isTtsPlaying ||
                  recording ||
                  !hasAnswer
                }>
                Next →
              </button>
            </div>

            {error && (
              <div className="p-4 glass rounded-xl bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {interviewStatus && (
              <div
                className={`p-4 glass rounded-xl ${
                  interviewStatusType === "success"
                    ? "bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30"
                    : interviewStatusType === "error"
                    ? "bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30"
                    : "bg-blue-500 bg-opacity-10 border border-blue-500 border-opacity-30"
                }`}>
                <p
                  className={`text-sm font-medium ${
                    interviewStatusType === "success"
                      ? "text-green-400"
                      : interviewStatusType === "error"
                      ? "text-red-400"
                      : "text-blue-400"
                  }`}>
                  {interviewStatus}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Answer Feedback Section */}
        {answerFeedback ? (
          <div className="glass glass-hover p-8 space-y-6">
            <h2 className="text-2xl font-semibold text-white">
              Answer Feedback
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Score Card */}
              <div className="glass p-6 rounded-xl bg-gradient-to-br from-blue-500 bg-opacity-10 border border-blue-500 border-opacity-30">
                <div className="text-sm text-blue-400 font-medium mb-2">
                  Score
                </div>
                <div className="text-4xl font-bold text-white">
                  {answerFeedback.score ?? "N/A"}
                </div>
                <div className="text-xs text-gray-400 mt-1">out of 5</div>
              </div>

              {/* Feedback Card */}
              <div className="glass p-6 rounded-xl bg-purple-500 bg-opacity-10 border border-purple-500 border-opacity-30">
                <div className="text-sm text-purple-400 font-medium mb-2">
                  Overall Feedback
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {answerFeedback.feedback ?? "No feedback provided."}
                </p>
              </div>
            </div>

            {/* Strengths and Weaknesses */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="glass p-6 rounded-xl bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30">
                <div className="text-sm text-green-400 font-semibold mb-3">
                  Strengths
                </div>
                <ul className="space-y-2">
                  {Array.isArray(answerFeedback.strengths) &&
                  answerFeedback.strengths.length ? (
                    answerFeedback.strengths.map((s: any, i: number) => (
                      <li
                        key={i}
                        className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-green-400 mt-1">✓</span>
                        <span>{s}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-gray-400">
                      No strengths provided.
                    </li>
                  )}
                </ul>
              </div>

              <div className="glass p-6 rounded-xl bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30">
                <div className="text-sm text-red-400 font-semibold mb-3">
                  Areas for Improvement
                </div>
                <ul className="space-y-2">
                  {Array.isArray(answerFeedback.weaknesses) &&
                  answerFeedback.weaknesses.length ? (
                    answerFeedback.weaknesses.map((w: any, i: number) => (
                      <li
                        key={i}
                        className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>{w}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-gray-400">
                      No weaknesses provided.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
