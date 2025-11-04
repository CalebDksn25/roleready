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
            onClick={() => router.push("/job-interview")}>
            Begin Interview Setup
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>
          <span className="text-gray-500 text-sm">OR</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>
        </div>

        {/* Quick Start Mock Interview Section */}
        <div className="glass glass-hover p-8 space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold text-white">
              Want to practice your interview skills? Click here to get started
            </h2>
            <p className="text-gray-400">
              Get personalized interview questions based on your resume
            </p>
          </div>
          <button
            className="px-8 py-4 glass bg-white bg-opacity-20 hover:bg-opacity-30 text-white border border-white border-opacity-30 hover:border-opacity-50 font-semibold rounded-xl shadow-lg transition-all duration-200 text-lg"
            type="button"
            onClick={() => router.push("/mock-interview")}>
            Begin Mock Interview
          </button>
        </div>
      </div>
    </main>
  );
}
