"use client";

/**
 * Repository Pattern Monitoring Dashboard
 *
 * Visualizes performance metrics and errors from the repository pattern implementation.
 * Helps compare the original implementation with the repository pattern implementation.
 *
 * Last Updated: Sat May 3 2025
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Metric types for typescript
interface OverallMetrics {
  totalOperations: number;
  averageSpeeds: {
    original: number;
    repository: number;
  };
  callCounts: {
    original: number;
    repository: number;
  };
  totalErrors: {
    original: number;
    repository: number;
  };
}

interface PerformanceData {
  [operation: string]: {
    callCount: number;
    totalDuration: {
      original: number;
      repository: number;
    };
    averageDuration: {
      original: number;
      repository: number;
    };
    callCounts: {
      original: number;
      repository: number;
    };
  };
}

interface ErrorData {
  [operation: string]: {
    original: number;
    repository: number;
  };
}

interface MonitoringData {
  overall: OverallMetrics;
  performance: PerformanceData;
  errors: ErrorData;
  timestamp: string;
}

export default function RepositoryMonitorPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const router = useRouter();

  // Function to fetch monitoring data
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/monitoring/repository");
      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(
        `Failed to load monitoring data: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  // Set up auto refresh
  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center p-8">
        <h1 className="text-2xl font-bold mb-4">
          Repository Pattern Monitoring
        </h1>
        <div className="w-full max-w-5xl bg-white rounded-lg shadow p-6">
          <p className="text-center text-gray-700">
            Loading monitoring data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center p-8">
        <h1 className="text-2xl font-bold mb-4">
          Repository Pattern Monitoring
        </h1>
        <div className="w-full max-w-5xl bg-white rounded-lg shadow p-6">
          <p className="text-center text-red-500">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Calculate improvement percentages
  const calculateImprovement = (repo: number, orig: number): string => {
    if (orig === 0) return "N/A";
    const improvement = ((orig - repo) / orig) * 100;
    return improvement > 0
      ? `${improvement.toFixed(1)}% faster`
      : `${Math.abs(improvement).toFixed(1)}% slower`;
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-2xl font-bold mb-4">Repository Pattern Monitoring</h1>

      <div className="w-full max-w-5xl space-y-6">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
          <div>
            <span className="text-sm text-gray-500">
              Last updated:{" "}
              {data?.timestamp
                ? new Date(data.timestamp).toLocaleString()
                : "Never"}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2"
              />
              Auto-refresh (10s)
            </label>
            <button
              onClick={fetchData}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Refresh Now
            </button>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Overall Performance</h2>

          {data?.overall && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded">
                <h3 className="text-sm font-medium text-gray-500">
                  Call Counts
                </h3>
                <div className="mt-2 flex justify-between">
                  <div>
                    <div className="text-lg font-bold">
                      {data.overall.callCounts.original}
                    </div>
                    <div className="text-xs text-gray-500">Original</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">
                      {data.overall.callCounts.repository}
                    </div>
                    <div className="text-xs text-gray-500">Repository</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <h3 className="text-sm font-medium text-gray-500">
                  Average Speed (ms)
                </h3>
                <div className="mt-2 flex justify-between">
                  <div>
                    <div className="text-lg font-bold">
                      {data.overall.averageSpeeds.original.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">Original</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">
                      {data.overall.averageSpeeds.repository.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">Repository</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-center">
                  {calculateImprovement(
                    data.overall.averageSpeeds.repository,
                    data.overall.averageSpeeds.original
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <h3 className="text-sm font-medium text-gray-500">
                  Error Counts
                </h3>
                <div className="mt-2 flex justify-between">
                  <div>
                    <div className="text-lg font-bold">
                      {data.overall.totalErrors.original}
                    </div>
                    <div className="text-xs text-gray-500">Original</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">
                      {data.overall.totalErrors.repository}
                    </div>
                    <div className="text-xs text-gray-500">Repository</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Operations Performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Operation Performance</h2>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operation
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Original Avg (ms)
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Repository Avg (ms)
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Difference
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Call Count
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.performance &&
                  Object.entries(data.performance).map(
                    ([operation, metrics]) => (
                      <tr key={operation}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {operation}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {metrics.averageDuration.original.toFixed(1)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {metrics.averageDuration.repository.toFixed(1)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {calculateImprovement(
                            metrics.averageDuration.repository,
                            metrics.averageDuration.original
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {metrics.callCounts.original} /{" "}
                          {metrics.callCounts.repository}
                        </td>
                      </tr>
                    )
                  )}

                {(!data?.performance ||
                  Object.keys(data.performance).length === 0) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      No performance data available yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Error Tracking */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Error Tracking</h2>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operation
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Original Errors
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Repository Errors
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.errors &&
                  Object.entries(data.errors).map(([operation, counts]) => (
                    <tr key={operation}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {operation}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {counts.original}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {counts.repository}
                      </td>
                    </tr>
                  ))}

                {(!data?.errors || Object.keys(data.errors).length === 0) && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      No errors recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
