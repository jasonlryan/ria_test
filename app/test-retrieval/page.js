"use client";

import React from "react";
import DataRetrievalTester from "../../components/DataRetrievalTester";

export default function TestRetrievalPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Data Retrieval System Testing
          </h1>
          <p className="mt-3 text-xl text-gray-500">
            Test the two-step data retrieval system with actual data files
          </p>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <DataRetrievalTester />
          </div>
        </div>

        <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              How It Works
            </h2>
            <div className="prose prose-blue">
              <h3>Two-Step Retrieval Process</h3>
              <ol>
                <li>
                  <strong>File Identification:</strong> The system uses OpenAI
                  to determine which data files are relevant to your query.
                </li>
                <li>
                  <strong>Complete Data Retrieval:</strong> The identified files
                  are retrieved in full from GitHub.
                </li>
                <li>
                  <strong>Analysis Generation:</strong> OpenAI analyzes the
                  complete data files to generate a response.
                </li>
                <li>
                  <strong>Validation:</strong> The system validates that all
                  percentages in the response match values in the actual data.
                </li>
              </ol>

              <h3>Benefits</h3>
              <ul>
                <li>
                  Ensures responses use only real data by providing complete
                  files
                </li>
                <li>Prevents data fabrication through validation</li>
                <li>Provides transparency about which files were used</li>
                <li>Enables more accurate and reliable analysis</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
