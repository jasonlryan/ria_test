"use client";

import { useState } from "react";

export default function DataRetrievalTester() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: Initial query, 2: Data retrieved

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

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
      setResult(data);
      setStep(2);
    } catch (err) {
      console.error("Error processing query:", err);
      setError(err.message);
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

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md mb-4">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Results:</h3>

          <div className="bg-gray-50 p-4 rounded-md mb-4">
            <h4 className="font-medium text-sm text-gray-700 mb-2">
              Files Used:
            </h4>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {result.metadata.files_used.map((file, index) => (
                <li key={index}>{file}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-gray-700">
              Total data points: {result.metadata.data_points}
            </p>
          </div>

          <div className="mb-4">
            <h4 className="font-medium mb-2">Analysis:</h4>
            <div className="bg-white border border-gray-200 rounded-md p-4 prose max-w-none">
              {result.analysis.split("\n").map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
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
                  ? `✓ Valid analysis using ${result.validation.percentagesUsed} percentage values from the data.`
                  : `⚠️ Invalid analysis: ${result.validation.fabricatedPercentages.length} fabricated percentages detected.`}
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
