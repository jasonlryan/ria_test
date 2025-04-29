#!/bin/bash

# A script to remove all tracing functionality from the RIA25 project

echo "Removing trace-related files and directories..."

# Remove the enable-tracing.js file from the root if it exists
rm -f ./enable-tracing.js
rm -f ./export-trace.js
rm -f ./trace-collector.js
rm -f ./test-trace.js
rm -f ./force-trace.js
rm -f ./manual-trace.js

# Remove any trace-related API routes
rm -rf ./app/api/trace-test
rm -rf ./app/api/trace-status
rm -rf ./app/api/trace-direct
rm -rf ./app/api/traces

# Remove the trace utility directory
rm -rf ./utils/trace

# Remove any instrumentation files
rm -f ./utils/shared/instrumentation.js
rm -f ./utils/shared/instrumentDemo.js
rm -f ./utils/data/audit/trace-analyzer.js

# Remove any trace README files
rm -f ./utils/shared/README-instrumentation.md

echo "Trace cleanup complete!" 