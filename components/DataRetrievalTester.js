"use client";

import React, { useState } from "react";

export default function DataRetrievalTester() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [processingTime, setProcessingTime] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [previousQuery, setPreviousQuery] = useState("");
  const [previousResponse, setPreviousResponse] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setProcessingTime(null);

    const startTime = Date.now();

    try {
      console.log(`Processing query: ${query}`);
      console.log(`ThreadId: ${threadId || "New thread"}`);
      console.log(`IsFollowUp: ${!!threadId}`);

      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          threadId,
          previousQuery,
          previousAssistantResponse: previousResponse,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process query");
      }

      const data = await response.json();
      console.log("Response data:", data);

      // Calculate client-side processing time
      const clientTime = Date.now() - startTime;
      // Use server-side processing time if available, otherwise client time
      const totalTime = data.processing_time_ms || clientTime;

      // Update thread state for continuity
      if (data.threadId && !threadId) {
        setThreadId(data.threadId);
      }

      // Store this query and response for the next interaction
      setPreviousQuery(query);
      if (data.analysis) {
        setPreviousResponse(data.analysis);
      }

      setResult(data);
      setProcessingTime(totalTime);
    } catch (err) {
      console.error("Error processing query:", err);
      setError(err.message);
      setProcessingTime(Date.now() - startTime);
    } finally {
      setLoading(false);
    }
  };

  const startNewThread = () => {
    setThreadId(null);
    setPreviousQuery("");
    setPreviousResponse("");
    setResult(null);
    setError(null);
    console.log("Started new thread - thread continuity reset");
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Query Data Retrieval</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="query" className="block mb-2 text-sm font-medium">
            Enter your query:
          </label>
          <textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-2 border rounded-md"
            rows={3}
            placeholder="What factors affect employee retention?"
          />
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-blue-300"
          >
            {loading ? "Processing..." : "Submit Query"}
          </button>

          <button
            type="button"
            onClick={startNewThread}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md"
          >
            New Thread
          </button>
        </div>
      </form>

      {/* Thread info */}
      {threadId && (
        <div className="mt-4 p-2 bg-gray-100 rounded text-sm">
          <p>Thread: {threadId.substring(0, 10)}... (follow-up mode enabled)</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md">
          <h3 className="font-semibold">Error</h3>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Results</h3>
          <div className="p-4 bg-gray-50 rounded-md overflow-auto max-h-96">
            <p className="text-sm text-gray-500 mb-2">
              Processed in {processingTime}ms
            </p>
            <pre className="whitespace-pre-wrap text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format markdown with basic HTML
function formatMarkdown(text) {
  if (!text) return "";

  // Convert headers
  text = text.replace(
    /### (.*?)\n/g,
    '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>'
  );
  text = text.replace(
    /#### (.*?)\n/g,
    '<h4 class="text-md font-medium mt-3 mb-1">$1</h4>'
  );

  // Convert bold
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert line breaks
  text = text.replace(/\n\n/g, "<br><br>");

  // Convert lists
  text = text.replace(/- (.*?)(\n|$)/g, "<li>$1</li>");

  return text;
}
