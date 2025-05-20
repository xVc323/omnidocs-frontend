"use client";

import React, { useState, useEffect, useRef } from "react";
import type { OutputFormat } from '../types';

export default function Home() {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("zip");
  const [isSingleFile, setIsSingleFile] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualPathPrefix, setManualPathPrefix] = useState("");
  const [excludeRegex, setExcludeRegex] = useState("");

  const [jobId, setJobId] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [r2DownloadLink, setR2DownloadLink] = useState<string | null>(null);
  const [expirationTime, setExpirationTime] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Connect to SSE stream for job progress updates when jobId is available
    if (jobId) {
      setProgressMessage("Connecting to job stream...");
      console.log(`Setting up EventSource for job ${jobId}`);
      
      // Close any existing connection
      if (eventSourceRef.current) {
        console.log("Closing existing EventSource connection");
        eventSourceRef.current.close();
      }
      
      // Create new event source with retry capability
      const eventSourceUrl = `/api/jobs/${jobId}/events`;
      console.log(`Opening EventSource connection to: ${eventSourceUrl}`);
      const eventSource = new EventSource(eventSourceUrl);
      eventSourceRef.current = eventSource;
      
      eventSource.onopen = () => {
        console.log("EventSource connection opened");
        setProgressMessage("Connected to job stream");
      };
      
      eventSource.onmessage = (event) => {
        console.log("EventSource message received:", event.data);
        try {
          const data = JSON.parse(event.data);
          
          if (data.status === "completed") {
            console.log("Job completed:", data);
            setIsLoading(false);
            setMessage("Conversion completed successfully!");
            setProgressMessage(null);
            setR2DownloadLink(`/api/download/${jobId}?format=${outputFormat}`);
            
            // Set expiration time if available
            if (data.expiresAt) {
              setExpirationTime(data.expiresAt);
            }
            
            eventSource.close();
          } else if (data.status === "failed") {
            console.log("Job failed:", data);
            setIsLoading(false);
            setError(data.error || "Conversion failed");
            setProgressMessage(null);
            eventSource.close();
          } else if (data.status === "processing") {
            console.log("Job progress update:", data);
            setProgressMessage(data.message || "Processing...");
          }
        } catch (err) {
          console.error("Error parsing event data:", err, event.data);
        }
      };
      
      eventSource.onerror = (err) => {
        console.error("EventSource error:", err);
        setError("Connection to job stream lost. Please refresh to check status.");
        eventSource.close();
      };
      
      // Cleanup
      return () => {
        console.log("Cleaning up EventSource connection");
        eventSource.close();
        eventSourceRef.current = null;
      };
    }
  }, [jobId, outputFormat]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setProgressMessage("Initiating conversion...");
    setJobId(null);
    setR2DownloadLink(null);
    setIsLoading(true);
    setIsSingleFile(outputFormat === "single_md");

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          outputFormat,
          manualPathPrefix: manualPathPrefix || undefined,
          excludeRegex: excludeRegex || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start conversion job");
      }

      const data = await response.json();
      setJobId(data.jobId);
    } catch (err: unknown) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 sm:p-8 bg-gradient-to-br from-slate-950 to-indigo-950 text-white">
      <div className="w-full max-w-2xl card p-6 sm:p-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-center text-indigo-400 tracking-tight">
          OmniDocs Converter
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="url" className="block text-sm font-medium mb-1">
              Documentation URL
            </label>
            <input
              type="url"
              name="url"
              id="url"
              className="input"
              placeholder="https://docs.example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <label htmlFor="outputFormat" className="block text-sm font-medium mb-1">
                Output Format
              </label>
              <select
                id="outputFormat"
                name="outputFormat"
                className="select"
                value={outputFormat}
                onChange={(e) => {
                  setOutputFormat(e.target.value as OutputFormat);
                  setIsSingleFile(e.target.value === "single_md");
                }}
                disabled={isLoading}
              >
                <option value="zip">ZIP (Multiple MD files + order.txt)</option>
                <option value="single_md">Single MD file (all_docs.md)</option>
              </select>
            </div>
            
            <div className="sm:pt-6">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm font-medium text-indigo-400 hover:text-indigo-300 focus:outline-none disabled:opacity-50"
                disabled={isLoading}
              >
                {showAdvanced ? "Hide Advanced" : "Show Advanced"}
              </button>
            </div>
          </div>

          {showAdvanced && (
            <div className="advanced-panel">
              <div>
                <label htmlFor="manualPathPrefix" className="block text-sm font-medium mb-1">
                  Manual Path Prefixes (Optional, Comma-separated)
                </label>
                <input
                  type="text"
                  name="manualPathPrefix"
                  id="manualPathPrefix"
                  className="input"
                  placeholder="/docs/v1,/api/v2"
                  value={manualPathPrefix}
                  onChange={(e) => setManualPathPrefix(e.target.value)}
                  disabled={isLoading}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Specify exact paths to crawl (e.g., &quot;/docs/guide,/tutorials&quot;)
                </p>
              </div>

              <div>
                <label htmlFor="excludeRegex" className="block text-sm font-medium mb-1">
                  Exclude Paths (Optional, One per line)
                </label>
                <textarea
                  name="excludeRegex"
                  id="excludeRegex"
                  rows={3}
                  className="input"
                  placeholder="/blog\n/changelog\n/community"
                  value={excludeRegex}
                  onChange={(e) => setExcludeRegex(e.target.value)}
                  disabled={isLoading}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Paths to exclude from crawling
                </p>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full btn btn-primary flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Converting...
                </>
              ) : (
                "Convert Documentation"
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-6 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {progressMessage && isLoading && (
          <div className="mt-6 p-3 bg-indigo-900/50 border border-indigo-700 rounded-md">
            <div className="flex items-center">
              <svg className="animate-spin mr-3 h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-sm text-indigo-200">
                <span className="font-medium">Status:</span> {progressMessage}
              </p>
            </div>
          </div>
        )}

        {message && (
          <div className="mt-6 p-3 bg-green-900/50 border border-green-700 rounded-md">
            <p className="text-sm text-green-200">{message}</p>
          </div>
        )}

        {r2DownloadLink && (
          <div className="mt-6 flex flex-col items-center">
            <a
              href={r2DownloadLink}
              download
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download {isSingleFile ? "MD File" : "ZIP Archive"}
            </a>
            
            {expirationTime && (
              <p className="mt-2 text-sm text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 inline-block mr-1">
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                </svg>
                File will be automatically deleted 1 hour after completion
              </p>
            )}
          </div>
        )}
      </div>

      <footer className="w-full max-w-2xl mt-8 text-center text-sm text-gray-400">
        <p>© 2025 OmniDocs Converter. All rights reserved.</p>
        <a 
          href="https://github.com/yourusername/omnidocs" 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center hover:text-indigo-400 transition-colors"
        >
          <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          View on GitHub
        </a>
      </footer>
    </main>
  );
}
