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

export default function InterviewPage() {
  const router = useRouter();
  const [jobInputType, setJobInputType] = useState<"link" | "description">(
    "link"
  );
  const [jobLink, setJobLink] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [interviewerLinkedin, setinterviewerLinkedin] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [errors, setErrors] = useState<{
    jobLink?: string;
    jobDescription?: string;
    companyName?: string;
    interviewerLinkedin?: string;
    resume?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (jobInputType === "link") {
      if (!jobLink.trim()) {
        newErrors.jobLink = "Job link is required";
      } else {
        // Basic URL validation
        try {
          new URL(jobLink);
        } catch {
          newErrors.jobLink = "Please enter a valid URL";
        }
      }
    } else {
      if (!jobDescription.trim()) {
        newErrors.jobDescription = "Job description is required";
      } else if (jobDescription.trim().length < 50) {
        newErrors.jobDescription =
          "Job description should be at least 50 characters";
      }

      if (!companyName.trim()) {
        newErrors.companyName = "Company name is required";
      }
    }

    if (!interviewerLinkedin.trim()) {
      newErrors.interviewerLinkedin = "Interviewer name is required";
    }

    if (!resumeFile) {
      newErrors.resume = "Resume file is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      setStatusMessage("Please fill in all required fields correctly");
      setUploadStatus("error");
      return;
    }

    setUploadStatus("uploading");
    setProgress(10);
    setProgressMessage("Preparing submission...");

    try {
      const formData = new FormData();
      formData.append("resume", resumeFile!);

      if (jobInputType === "link") {
        formData.append("jobLink", jobLink);
      } else {
        formData.append("jobDescription", jobDescription);
        formData.append("companyName", companyName);
      }

      formData.append("interviewerName", interviewerLinkedin);
      formData.append("jobInputType", jobInputType);

      setProgress(30);
      setProgressMessage("Uploading resume and job details...");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      setProgress(60);
      setProgressMessage("Processing information...");

      const result = await response.json();

      if (response.ok) {
        setProgress(90);
        setProgressMessage("Setting up interview...");

        // Optional: Store the interview context in sessionStorage or pass via query params
        if (jobInputType === "link") {
          sessionStorage.setItem("jobLink", jobLink);
        } else {
          sessionStorage.setItem("jobDescription", jobDescription);
          sessionStorage.setItem("companyName", companyName);
        }
        sessionStorage.setItem("interviewerName", interviewerLinkedin);
        sessionStorage.setItem("jobInputType", jobInputType);

        setProgress(100);
        setProgressMessage("Setup complete! Redirecting...");
        setUploadStatus("success");
        setStatusMessage(
          `Successfully uploaded resume and saved interview details. ${
            result.chunkCount ? `Embedded ${result.chunkCount} chunks.` : ""
          }`
        );

        // Redirect to main page after a short delay
        setTimeout(() => {
          router.push("/job-interview");
        }, 1500);
      } else {
        setProgress(0);
        setUploadStatus("error");
        setStatusMessage(
          `Failed to upload: ${result.error || "Unknown error"}`
        );
      }
    } catch (error: any) {
      setProgress(0);
      setUploadStatus("error");
      setStatusMessage(`Upload failed: ${error.message || "Unknown error"}`);
    }
  };

  return (
    <main className="min-h-screen p-6 md:p-12 bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2 transition-colors">
            ← Back
          </button>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
            Interview Setup
          </h1>
          <p className="text-gray-400 text-lg">
            Provide your information to start a personalized interview
          </p>
        </div>

        {/* Progress Bar */}
        <ProgressBar progress={progress} message={progressMessage} />

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="glass glass-hover p-8 space-y-6">
            {/* Job Input Type Selection */}
            <div className="space-y-2">
              <label className="block text-lg font-semibold text-white mb-3">
                Job Information
                <span className="text-red-400 ml-1">*</span>
              </label>
              <div className="flex gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setJobInputType("link");
                    setErrors({
                      ...errors,
                      jobLink: undefined,
                      jobDescription: undefined,
                      companyName: undefined,
                    });
                  }}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    jobInputType === "link"
                      ? "glass bg-white bg-opacity-40 text-white border-2 border-white border-opacity-70 shadow-lg shadow-white shadow-opacity-25 ring-2 ring-white ring-opacity-25"
                      : "glass bg-black bg-opacity-20 text-gray-500 border border-gray-700 border-opacity-40"
                  }`}>
                  Job Link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setJobInputType("description");
                    setErrors({
                      ...errors,
                      jobLink: undefined,
                      jobDescription: undefined,
                      companyName: undefined,
                    });
                  }}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    jobInputType === "description"
                      ? "glass bg-white bg-opacity-40 text-white border-2 border-white border-opacity-70 shadow-lg shadow-white shadow-opacity-25 ring-2 ring-white ring-opacity-25"
                      : "glass bg-black bg-opacity-20 text-gray-500 border border-gray-700 border-opacity-40"
                  }`}>
                  Job Description
                </button>
              </div>

              {/* Job Link Input */}
              {jobInputType === "link" && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">
                    Paste the link to the job listing. We'll use this to tailor
                    the interview questions.
                  </p>
                  <input
                    id="jobLink"
                    type="url"
                    value={jobLink}
                    onChange={(e) => {
                      setJobLink(e.target.value);
                      if (errors.jobLink) {
                        setErrors({ ...errors, jobLink: undefined });
                      }
                    }}
                    className="w-full px-4 py-3 glass rounded-xl border border-gray-700 bg-black bg-opacity-30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="https://jobs.company.com/listing/12345..."
                  />
                  {errors.jobLink && (
                    <p className="text-sm text-red-400">{errors.jobLink}</p>
                  )}
                </div>
              )}

              {/* Job Description Input */}
              {jobInputType === "description" && (
                <div className="space-y-4">
                  {/* Company Name */}
                  <div className="space-y-2">
                    <label
                      htmlFor="companyName"
                      className="block text-sm font-semibold text-gray-300">
                      Company Name
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      id="companyName"
                      type="text"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        if (errors.companyName) {
                          setErrors({ ...errors, companyName: undefined });
                        }
                      }}
                      className="w-full px-4 py-3 glass rounded-xl border border-gray-700 bg-black bg-opacity-30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter the company name..."
                    />
                    {errors.companyName && (
                      <p className="text-sm text-red-400">
                        {errors.companyName}
                      </p>
                    )}
                  </div>

                  {/* Job Description Textarea */}
                  <div className="space-y-2">
                    <label
                      htmlFor="jobDescription"
                      className="block text-sm font-semibold text-gray-300">
                      Job Description
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <p className="text-sm text-gray-400">
                      Paste the full job description, including requirements,
                      responsibilities, and qualifications.
                    </p>
                    <textarea
                      id="jobDescription"
                      value={jobDescription}
                      onChange={(e) => {
                        setJobDescription(e.target.value);
                        if (errors.jobDescription) {
                          setErrors({ ...errors, jobDescription: undefined });
                        }
                      }}
                      rows={8}
                      className="w-full px-4 py-3 glass rounded-xl border border-gray-700 bg-black bg-opacity-30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      placeholder="Enter the complete job description, including requirements, responsibilities, and qualifications..."
                    />
                    {errors.jobDescription && (
                      <p className="text-sm text-red-400">
                        {errors.jobDescription}
                      </p>
                    )}
                    <div className="text-xs text-gray-500 text-right">
                      {jobDescription.length} characters
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Interviewer LinkedIn */}
            <div className="space-y-2">
              <label
                htmlFor="interviewerName"
                className="block text-lg font-semibold text-white">
                Interviewer LinkedIn
                <span className="text-red-400 ml-1">*</span>
              </label>
              <p className="text-sm text-gray-400">
                Who will be conducting your interview? (e.g., "Sarah Johnson,
                Hiring Manager" or "John Smith, Engineering Team Lead")
              </p>
              <input
                id="interviewerLinkedin"
                type="text"
                value={interviewerLinkedin}
                onChange={(e) => {
                  setinterviewerLinkedin(e.target.value);
                  if (errors.interviewerLinkedin) {
                    setErrors({ ...errors, interviewerLinkedin: undefined });
                  }
                }}
                className="w-full px-4 py-3 glass rounded-xl border border-gray-700 bg-black bg-opacity-30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter interviewer's LinkedIn"
              />
              {errors.interviewerLinkedin && (
                <p className="text-sm text-red-400">
                  {errors.interviewerLinkedin}
                </p>
              )}
            </div>

            {/* Resume Upload */}
            <div className="space-y-2">
              <label
                htmlFor="resume"
                className="block text-lg font-semibold text-white">
                Resume
                <span className="text-red-400 ml-1">*</span>
              </label>
              <p className="text-sm text-gray-400">
                Upload your resume in PDF format. We'll analyze it to generate
                relevant interview questions.
              </p>
              <label className="block">
                <div className="glass p-6 rounded-xl cursor-pointer hover:bg-opacity-80 transition-all duration-200 border-2 border-dashed border-gray-600 hover:border-blue-500">
                  <input
                    id="resume"
                    type="file"
                    className="hidden"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setResumeFile(file);
                        setFileName(file.name);
                        if (errors.resume) {
                          setErrors({ ...errors, resume: undefined });
                        }
                      }
                    }}
                    required
                  />
                  <div className="text-center space-y-2">
                    {fileName ? (
                      <>
                        <div className="text-blue-400 text-base font-medium">
                          ✓ {fileName}
                        </div>
                        <div className="text-gray-500 text-xs">
                          Click to change file
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-blue-400 text-base font-medium">
                          Choose PDF file
                        </div>
                        <div className="text-gray-500 text-xs">
                          PDF files only (Max 10MB)
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </label>
              {errors.resume && (
                <p className="text-sm text-red-400">{errors.resume}</p>
              )}
            </div>
          </div>

          {/* Status Messages */}
          {statusMessage && (
            <div
              className={`p-4 glass rounded-xl ${
                uploadStatus === "success"
                  ? "bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30"
                  : "bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30"
              }`}>
              <p
                className={`text-sm font-medium ${
                  uploadStatus === "success" ? "text-green-400" : "text-red-400"
                }`}>
                {statusMessage}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-6 py-4 glass glass-hover text-white rounded-xl font-semibold transition-all duration-200">
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploadStatus === "uploading"}
              className="flex-1 px-6 py-4 glass bg-white bg-opacity-20 hover:bg-opacity-30 text-white border border-white border-opacity-30 hover:border-opacity-50 font-semibold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {uploadStatus === "uploading"
                ? "Processing..."
                : uploadStatus === "success"
                ? "✓ Complete"
                : "Submit & Continue"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
