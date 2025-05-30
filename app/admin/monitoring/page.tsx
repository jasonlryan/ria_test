"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./monitoring.module.css";

interface OpenAIMonitoringData {
  migrationStatus: {
    useResponsesApiEnabled: boolean;
    unifiedOpenAIServiceEnabled: boolean;
    monitorMigrationEnabled: boolean;
    fallbackToLegacyEnabled: boolean;
  };
  callDistribution: {
    unified: number;
    legacy: number;
    total: number;
    percentage: string;
  };
  errorMetrics: {
    unified: {
      count: number;
      rate: string;
    };
    legacy: {
      count: number;
      rate: string;
    };
    hasSignificantIssues: boolean;
  };
  performanceMetrics: {
    unified: {
      averageMs: string;
      samples: number;
    };
    legacy: {
      averageMs: string;
      samples: number;
    };
    comparison: string;
  };
  lastUpdated: string;
}

interface RepositoryMetricsData {
  overall: {
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
  };
  performance: Record<
    string,
    {
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
    }
  >;
  errors: Record<
    string,
    {
      original: number;
      repository: number;
    }
  >;
  timestamp: string;
  message?: string;
}

type MonitoringTab = "openai" | "repository";

export default function MonitoringDashboard() {
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "repository" ? "repository" : "openai";
  const [activeTab, setActiveTab] = useState<MonitoringTab>(initialTab);
  const [openaiData, setOpenaiData] = useState<OpenAIMonitoringData | null>(
    null
  );
  const [repoData, setRepoData] = useState<RepositoryMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Function to fetch data from the consolidated API endpoint
  const fetchData = async () => {
    try {
      setLoading(true);
      const endpoint = `/api/admin/monitoring?type=${activeTab}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${response.statusText}`);
      }

      const result = await response.json();

      if (activeTab === "openai") {
        setOpenaiData(result);
      } else {
        setRepoData(result);
      }

      setError(null);
    } catch (err) {
      setError(err.message || `Failed to fetch ${activeTab} monitoring data`);
      console.error(`${activeTab} monitoring error:`, err);
    } finally {
      setLoading(false);
    }
  };

  // Set up auto-refresh if enabled
  useEffect(() => {
    // Initial data load
    fetchData();

    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, activeTab]);

  // Fetch data when tab changes
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Render status badge with color based on status
  const StatusBadge = ({ enabled }: { enabled: boolean }) => (
    <span className={enabled ? styles.statusEnabled : styles.statusDisabled}>
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );

  // Calculate improvement percentages for repository metrics
  const calculateImprovement = (repo: number, orig: number): string => {
    if (orig === 0) return "N/A";
    const improvement = ((orig - repo) / orig) * 100;
    return improvement > 0
      ? `${improvement.toFixed(1)}% faster`
      : `${Math.abs(improvement).toFixed(1)}% slower`;
  };

  const renderOpenAIMonitoring = () => {
    if (!openaiData)
      return (
        <div className={styles.loading}>
          No OpenAI monitoring data available
        </div>
      );

    return (
      <>
        <div className={styles.section}>
          <h2>Feature Flag Status</h2>
          <div className={styles.statusGrid}>
            <div className={styles.statusItem}>
              <span>USE_RESPONSES_API:</span>
              <StatusBadge
                enabled={openaiData.migrationStatus.useResponsesApiEnabled}
              />
            </div>
            <div className={styles.statusItem}>
              <span>UNIFIED_OPENAI_SERVICE:</span>
              <StatusBadge
                enabled={openaiData.migrationStatus.unifiedOpenAIServiceEnabled}
              />
            </div>
            <div className={styles.statusItem}>
              <span>MONITOR_MIGRATION:</span>
              <StatusBadge
                enabled={openaiData.migrationStatus.monitorMigrationEnabled}
              />
            </div>
            <div className={styles.statusItem}>
              <span>FALLBACK_TO_LEGACY:</span>
              <StatusBadge
                enabled={openaiData.migrationStatus.fallbackToLegacyEnabled}
              />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>API Call Distribution</h2>
          <div className={styles.chartContainer}>
            <div className={styles.barChart}>
              <div
                className={styles.barUnified}
                style={{ width: openaiData.callDistribution.percentage }}
              >
                {openaiData.callDistribution.unified} (
                {openaiData.callDistribution.percentage})
              </div>
              <div className={styles.barLegacy}>
                {openaiData.callDistribution.legacy} calls
              </div>
            </div>
            <div className={styles.chartLabels}>
              <div>Unified Service</div>
              <div>Legacy Service</div>
            </div>
          </div>
          <div className={styles.totalCalls}>
            Total Calls: {openaiData.callDistribution.total}
          </div>
        </div>

        <div className={styles.section}>
          <h2>Error Metrics</h2>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <h3>Unified Service Errors</h3>
              <div className={styles.metricValue}>
                {openaiData.errorMetrics.unified.count}
              </div>
              <div className={styles.metricSubtext}>
                Error Rate: {openaiData.errorMetrics.unified.rate}
              </div>
            </div>
            <div className={styles.metricCard}>
              <h3>Legacy Service Errors</h3>
              <div className={styles.metricValue}>
                {openaiData.errorMetrics.legacy.count}
              </div>
              <div className={styles.metricSubtext}>
                Error Rate: {openaiData.errorMetrics.legacy.rate}
              </div>
            </div>
          </div>
          {openaiData.errorMetrics.hasSignificantIssues && (
            <div className={styles.warningBanner}>
              ⚠️ Significant issues detected that may warrant rollback
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h2>Performance Metrics</h2>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <h3>Unified Service Response Time</h3>
              <div className={styles.metricValue}>
                {openaiData.performanceMetrics.unified.averageMs} ms
              </div>
              <div className={styles.metricSubtext}>
                Samples: {openaiData.performanceMetrics.unified.samples}
              </div>
            </div>
            <div className={styles.metricCard}>
              <h3>Legacy Service Response Time</h3>
              <div className={styles.metricValue}>
                {openaiData.performanceMetrics.legacy.averageMs} ms
              </div>
              <div className={styles.metricSubtext}>
                Samples: {openaiData.performanceMetrics.legacy.samples}
              </div>
            </div>
          </div>
          <div className={styles.comparisonMetric}>
            Unified vs Legacy: {openaiData.performanceMetrics.comparison}
            {openaiData.performanceMetrics.comparison !== "N/A" &&
              parseFloat(openaiData.performanceMetrics.comparison) > 120 && (
                <span className={styles.warningText}>
                  &nbsp;⚠️ Unified service significantly slower
                </span>
              )}
          </div>
        </div>
      </>
    );
  };

  const renderRepositoryMonitoring = () => {
    if (!repoData)
      return (
        <div className={styles.loading}>
          No repository monitoring data available
        </div>
      );

    return (
      <>
        <div className={styles.section}>
          <h2>Overall Performance</h2>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <h3>Call Counts</h3>
              <div className={styles.metricColumns}>
                <div>
                  <div className={styles.metricValue}>
                    {repoData.overall.callCounts.original}
                  </div>
                  <div className={styles.metricSubtext}>Original</div>
                </div>
                <div>
                  <div className={styles.metricValue}>
                    {repoData.overall.callCounts.repository}
                  </div>
                  <div className={styles.metricSubtext}>Repository</div>
                </div>
              </div>
            </div>

            <div className={styles.metricCard}>
              <h3>Average Speed (ms)</h3>
              <div className={styles.metricColumns}>
                <div>
                  <div className={styles.metricValue}>
                    {repoData.overall.averageSpeeds.original.toFixed(1)}
                  </div>
                  <div className={styles.metricSubtext}>Original</div>
                </div>
                <div>
                  <div className={styles.metricValue}>
                    {repoData.overall.averageSpeeds.repository.toFixed(1)}
                  </div>
                  <div className={styles.metricSubtext}>Repository</div>
                </div>
              </div>
              <div
                className={styles.metricSubtext}
                style={{ textAlign: "center", marginTop: "0.5rem" }}
              >
                {calculateImprovement(
                  repoData.overall.averageSpeeds.repository,
                  repoData.overall.averageSpeeds.original
                )}
              </div>
            </div>

            <div className={styles.metricCard}>
              <h3>Error Counts</h3>
              <div className={styles.metricColumns}>
                <div>
                  <div className={styles.metricValue}>
                    {repoData.overall.totalErrors.original}
                  </div>
                  <div className={styles.metricSubtext}>Original</div>
                </div>
                <div>
                  <div className={styles.metricValue}>
                    {repoData.overall.totalErrors.repository}
                  </div>
                  <div className={styles.metricSubtext}>Repository</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Operation Performance</h2>
          <div className={styles.tableContainer}>
            <table className={styles.operationsTable}>
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Original Avg (ms)</th>
                  <th>Repository Avg (ms)</th>
                  <th>Difference</th>
                  <th>Call Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(repoData.performance).length > 0 ? (
                  Object.entries(repoData.performance).map(
                    ([operation, metrics]) => (
                      <tr key={operation}>
                        <td>{operation}</td>
                        <td>{metrics.averageDuration.original.toFixed(1)}</td>
                        <td>{metrics.averageDuration.repository.toFixed(1)}</td>
                        <td>
                          {calculateImprovement(
                            metrics.averageDuration.repository,
                            metrics.averageDuration.original
                          )}
                        </td>
                        <td>
                          {metrics.callCounts.original} /{" "}
                          {metrics.callCounts.repository}
                        </td>
                      </tr>
                    )
                  )
                ) : (
                  <tr>
                    <td colSpan={5}>No operation data recorded yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Error Tracking</h2>
          <div className={styles.tableContainer}>
            <table className={styles.operationsTable}>
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Original Errors</th>
                  <th>Repository Errors</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(repoData.errors).length > 0 ? (
                  Object.entries(repoData.errors).map(([operation, errors]) => (
                    <tr key={operation}>
                      <td>{operation}</td>
                      <td>{errors.original}</td>
                      <td>{errors.repository}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>No errors recorded yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>RIA25 Monitoring Dashboard</h1>

      {error && (
        <div className={styles.error}>
          <p>Error: {error}</p>
          <button onClick={() => fetchData()} className={styles.button}>
            Retry
          </button>
        </div>
      )}

      <div className={styles.infoBox}>
        <p>
          <strong>Note:</strong> This dashboard does not update on its own. Data
          is collected when:
        </p>
        <ul>
          <li>
            <strong>OpenAI Migration:</strong> Updated when OpenAI API calls are
            made through your application
          </li>
          <li>
            <strong>Repository Pattern:</strong> Updated when repository pattern
            code is executed
          </li>
        </ul>
        <p>
          To see new data, run the functions you want to monitor and then
          refresh this page.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabNavigation}>
        <button
          className={`${styles.tabButton} ${
            activeTab === "openai" ? styles.activeTab : ""
          }`}
          onClick={() => setActiveTab("openai")}
        >
          OpenAI Migration
        </button>
        <button
          className={`${styles.tabButton} ${
            activeTab === "repository" ? styles.activeTab : ""
          }`}
          onClick={() => setActiveTab("repository")}
        >
          Repository Pattern
        </button>
      </div>

      {loading && !openaiData && !repoData && (
        <div className={styles.loading}>Loading dashboard data...</div>
      )}

      {(openaiData || repoData) && (
        <div className={styles.dashboard}>
          <div className={styles.controls}>
            <button onClick={() => fetchData()} className={styles.button}>
              Refresh Data
            </button>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={() => setAutoRefresh(!autoRefresh)}
              />
              Auto-refresh (10s)
            </label>
            <div className={styles.lastUpdated}>
              Last updated:{" "}
              {activeTab === "openai"
                ? openaiData
                  ? new Date(openaiData.lastUpdated).toLocaleString()
                  : "Never"
                : repoData
                ? new Date(repoData.timestamp).toLocaleString()
                : "Never"}
            </div>
          </div>

          {/* Render content based on active tab */}
          {activeTab === "openai"
            ? renderOpenAIMonitoring()
            : renderRepositoryMonitoring()}

          <div className={styles.actionRow}>
            <Link href="/" className={styles.buttonLink}>
              Back to Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
