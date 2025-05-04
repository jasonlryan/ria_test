"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Repository Pattern Monitoring Dashboard
 *
 * This page now redirects to the unified monitoring dashboard
 * to eliminate duplication across monitoring systems.
 */
export default function RepositoryMonitorRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the unified monitoring dashboard with repository tab activated
    router.push("/admin/monitoring?tab=repository");
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-2xl font-bold mb-4">Repository Pattern Monitoring</h1>
      <div className="w-full max-w-5xl bg-white rounded-lg shadow p-6">
        <p className="text-center text-gray-700">
          Redirecting to the unified monitoring dashboard...
        </p>
      </div>
    </div>
  );
}
