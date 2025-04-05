"use client";

import { useState } from "react";

export default function DataRetrievalTester() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [processingTime, setProcessingTime] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setProcessingTime(null);

    const startTime = Date.now();

    try {
      console.log(`Processing query: ${query}`);
      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
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

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Data Retrieval System Tester</h2>

      <form onSubmit={handleSubmit} className="mb-4">
        <div className="mb-4">
          <label
            htmlFor="query"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Enter your query:
          </label>
          <textarea
            id="query"
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are the top workforce trends in 2025?"
            disabled={loading}
            required
          />
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          disabled={loading || !query.trim()}
        >
          {loading ? "Processing..." : "Submit Query"}
        </button>
      </form>

      {processingTime && (
        <div className="mt-2 mb-4">
          <p className="text-sm text-gray-600">
            Processing completed in {(processingTime / 1000).toFixed(2)} seconds
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md mb-4">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Results:</h3>

          {result.matched_topics && result.matched_topics.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-md mb-4">
              <h4 className="font-medium text-sm text-gray-700 mb-2">
                Matched Topics:
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {result.matched_topics.map((topic, index) => (
                  <li key={index}>{topic}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded-md mb-4">
            <h4 className="font-medium text-sm text-gray-700 mb-2">
              Files Used:
            </h4>
            {result.files_used && result.files_used.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {result.files_used.map((file, index) => (
                  <li key={index}>{file}</li>
                ))}
              </ul>
            ) : result.metadata && result.metadata.files_used ? (
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {result.metadata.files_used.map((file, index) => (
                  <li key={index}>{file}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">No files were used</p>
            )}
            <p className="mt-2 text-sm text-gray-700">
              Total data points:{" "}
              {(result.metadata && result.metadata.data_points) ||
                result.data_points ||
                0}
            </p>
          </div>

          <div className="mb-4">
            <h4 className="font-medium mb-2">Analysis:</h4>
            <div className="bg-white border border-gray-200 rounded-md p-4 prose max-w-none">
              {result.analysis ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: formatMarkdown(result.analysis),
                  }}
                />
              ) : (
                <p className="text-gray-600">No analysis available</p>
              )}
            </div>
          </div>

          {result.validation && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="font-medium text-sm text-gray-700 mb-2">
                Validation:
              </h4>
              <p
                className={`text-sm ${
                  result.validation.valid ? "text-green-600" : "text-red-600"
                }`}
              >
                {result.validation.valid
                  ? `✓ Valid analysis using ${
                      result.validation.percentagesUsed || 0
                    } percentage values from the data.`
                  : `⚠️ Invalid analysis: ${
                      result.validation.fabricatedPercentages?.length || 0
                    } fabricated percentages detected.`}
              </p>

              {result.validation.potentialIssues &&
                result.validation.potentialIssues.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700">
                      Potential Issues:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                      {result.validation.potentialIssues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
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
