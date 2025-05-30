# Assistant Tests

**Last Updated:** Tue May 6 2025

This directory contains test scripts for evaluating different aspects of the application.

## Structure

```
tests/
├── data/              # Sample data files used in manual tests
├── test-results/      # Generated test results with timestamps
├── repository/        # Repository pattern unit tests (Vitest)
│   ├── test-factory.ts    # Test object factories
│   ├── mocks.ts           # Mock implementations
│   ├── adapters/          # Adapter tests
│   └── implementations/   # Implementation tests
├── manual_tests/      # Manual test scripts (not in automated test suite)
│   ├── test_compatibility_pipeline.js # End-to-end compatibility tests
│   └── README.md          # Test descriptions and status
├── legacy/            # Deprecated test scripts kept for reference
│   └── compatibility_smoke_test.js    # Legacy compatibility module tests
├── setup.ts           # Vitest setup configuration
└── README.md          # This file
```

## Running Tests

### Repository Pattern Unit Tests

To run repository pattern unit tests with Vitest:

```bash
npm run test:unit           # Run all unit tests
npm run test:unit <path>    # Run tests in a specific path
npm run test:watch          # Run in watch mode
npm run test:coverage       # Run with coverage report
```

Example:

```bash
npm run test:unit tests/repository/QueryContext.test.ts
```

## Repository Pattern Implementation

The repository pattern has been fully implemented with a gradual rollout strategy. The implementation includes:

1. **Core Components**:

   - FileRepository: Abstraction for file access operations
   - QueryProcessor: Handles query processing with retrieved data
   - QueryContext: Standardized context for query operations

2. **Adapters**:

   - retrieval-adapter.ts: Compatible wrapper for utils/openai/retrieval.js
   - service-adapter.ts: Compatible wrapper for dataRetrievalService.ts

3. **Feature Flag System**:

   - Environment variable: USE_REPOSITORY_PATTERN
   - Shadow mode: REPOSITORY_SHADOW_MODE
   - Traffic percentage: REPOSITORY_TRAFFIC_PERCENTAGE

4. **Monitoring System**:
   - Performance metrics tracking for original vs. repository implementations
   - Error rate comparison
   - Operation timing statistics

### Repository Toggle Scripts

The repository pattern implementation includes a toggle script for controlling the rollout:

```bash
npm run repo:status      # Check current rollout status
npm run repo:shadow      # Enable shadow mode (log both implementations)
npm run repo:test5       # Test with 5% traffic
npm run repo:test10      # Test with 10% traffic
npm run repo:test25      # Test with 25% traffic
npm run repo:test50      # Test with 50% traffic
npm run repo:full        # Full implementation (100%)
npm run repo:off         # Turn off repository pattern
npm run repo:monitor     # Run monitoring dashboard on port 3001
```

### Monitoring Dashboard

A monitoring dashboard is available at `/repository-monitor` that provides:

1. Real-time performance comparison between original and repository implementations
2. Error tracking and rate comparison
3. Operation-specific metrics for detailed analysis
4. Automatic refresh with configurable interval

## Repository Pattern Tests

The repository pattern tests use Vitest and verify:

1. Interface implementations (QueryContext, FileRepository, QueryProcessor)
2. Adapter implementations for backward compatibility
3. Shadow testing between original and new implementations
4. Performance metrics for comparative analysis

### Adding New Repository Tests

To add repository tests:

1. Create a test file in the appropriate directory:

   - `/tests/repository/implementations/` for implementation tests
   - `/tests/repository/adapters/` for adapter tests

2. Follow the existing test patterns with describe/it blocks
3. Use the mock factories in `test-factory.ts` for consistent test objects
4. Run the tests with `npm run test:unit`

## Environment Variables

Repository pattern uses these environment variables:

- `USE_REPOSITORY_PATTERN` - Main feature flag for repository pattern (true/false)
- `REPOSITORY_SHADOW_MODE` - Enable shadow mode to run both implementations (true/false)
- `REPOSITORY_TRAFFIC_PERCENTAGE` - Percentage of traffic to route through repository (0-100)

## Rollout Strategy

The repository pattern implementation follows a phased rollout approach:

1. **Shadow Mode**: Run both implementations, compare results, use original
2. **Limited Testing**: Route small percentage of traffic (5-10%) through repository
3. **Expanded Testing**: Increase traffic allocation (25-50%) with monitoring
4. **Full Implementation**: Switch all traffic to repository pattern implementation
5. **Cleanup**: Remove original implementation code after stable period

At each phase, performance metrics and error rates are monitored to ensure no regressions.

_Last updated: Tue May 6 2025_
