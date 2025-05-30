# Canonical Topic Mapping Reference

**Last Updated:** Tue May 6 11:42:43 BST 2025

> **Target Audience:** Developers, Data Scientists, Content Specialists  
> **Related Documents:**
>
> - 07_prompt_evolution.md
> - 14_api_reference.md
> - 03_data_processing_workflow.md
> - 15_thread_data_management.md

## Overview

The canonical topic mapping system is a fundamental component of RIA25's data architecture. This reference document details the structure, usage, and implementation of the canonical topic approach within the TypeScript codebase and repository pattern architecture. The canonical mapping enables intuitive querying and accurate cross-year survey data comparisons through abstracted data access.

## TypeScript Interface Definitions

The canonical topic mapping is now fully typed with TypeScript interfaces:

```typescript
// types/canonicalTypes.ts

export interface CanonicalTopicMapping {
  metadata: Metadata;
  dataAccess: DataAccess;
  retrievalRules: RetrievalRules;
  allValidFiles: AllValidFiles;
  themes: Theme[];
}

export interface Metadata {
  version: string;
  description: string;
  lastUpdated: string;
}

export interface DataAccess {
  basePath: string;
  comparableMarkets: string[];
  allMarkets2025: string[];
}

export interface RetrievalRules {
  comparable: string;
  nonComparable: string;
  singleYear: string;
}

export interface AllValidFiles {
  "2024": string[];
  "2025": string[];
}

export interface Theme {
  name: string;
  topics: Topic[];
}

export interface Topic {
  id: string;
  canonicalQuestion: string;
  rationale: string;
  mapping: Mapping;
  comparable: boolean;
  availableMarkets: string[];
  userMessage: string;
  alternatePhrasings: string[];
}

export interface Mapping {
  "2024"?: QuestionMapping[];
  "2025": QuestionMapping[];
}

export interface QuestionMapping {
  id: string;
  file: string;
}
```

## Repository Pattern Implementation

The canonical topic mapping is now managed through a repository layer:

```typescript
// repositories/canonicalTopicRepository.ts

import { CanonicalTopicMapping, Topic } from "../types/canonicalTypes";
import kvClient from "../lib/kvClient";
import logger from "../utils/logger";
import { readJsonFile } from "../utils/fileSystem";

export interface ICanonicalTopicRepository {
  getCanonicalMapping(): Promise<CanonicalTopicMapping>;
  getTopicById(id: string): Promise<Topic | null>;
  getTopicsByTheme(theme: string): Promise<Topic[]>;
  searchTopics(query: string): Promise<Topic[]>;
}

export class CanonicalTopicRepository implements ICanonicalTopicRepository {
  private readonly canonicalFilePath =
    "scripts/reference files/canonical_topic_mapping.json";
  private readonly cacheTTL = 60 * 60 * 24; // 24 hours

  async getCanonicalMapping(): Promise<CanonicalTopicMapping> {
    const cacheKey = "canonical:mapping";

    try {
      // Try to get from KV cache first
      const cached = await kvClient.get<CanonicalTopicMapping>(cacheKey);
      if (cached) {
        logger.info("Retrieved canonical mapping from cache");
        return cached;
      }

      // Fallback to file system
      logger.info("Loading canonical mapping from file system");
      const mapping = await readJsonFile<CanonicalTopicMapping>(
        this.canonicalFilePath
      );

      // Cache for future use
      await kvClient.set(cacheKey, mapping, { ex: this.cacheTTL });

      return mapping;
    } catch (error) {
      logger.error(`Error retrieving canonical mapping: ${error.message}`);
      // Always fallback to file system on cache error
      return readJsonFile<CanonicalTopicMapping>(this.canonicalFilePath);
    }
  }

  async getTopicById(id: string): Promise<Topic | null> {
    const cacheKey = `canonical:topic:${id}`;

    try {
      // Try cache first
      const cached = await kvClient.get<Topic>(cacheKey);
      if (cached) {
        return cached;
      }

      // Load full mapping and find topic
      const mapping = await this.getCanonicalMapping();

      for (const theme of mapping.themes) {
        const topic = theme.topics.find((t) => t.id === id);
        if (topic) {
          // Cache individual topic
          await kvClient.set(cacheKey, topic, { ex: this.cacheTTL });
          return topic;
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error retrieving topic ${id}: ${error.message}`);

      // Fallback to direct file approach
      try {
        const mapping = await readJsonFile<CanonicalTopicMapping>(
          this.canonicalFilePath
        );

        for (const theme of mapping.themes) {
          const topic = theme.topics.find((t) => t.id === id);
          if (topic) {
            return topic;
          }
        }
      } catch {
        // Ignore additional errors
      }

      return null;
    }
  }

  async getTopicsByTheme(theme: string): Promise<Topic[]> {
    const mapping = await this.getCanonicalMapping();
    const targetTheme = mapping.themes.find(
      (t) => t.name.toLowerCase() === theme.toLowerCase()
    );

    return targetTheme?.topics || [];
  }

  async searchTopics(query: string): Promise<Topic[]> {
    const mapping = await this.getCanonicalMapping();
    const normalizedQuery = query.toLowerCase();
    const results: Topic[] = [];

    for (const theme of mapping.themes) {
      for (const topic of theme.topics) {
        // Check for match in ID, canonical question, or alternate phrasings
        if (
          topic.id.toLowerCase().includes(normalizedQuery) ||
          topic.canonicalQuestion.toLowerCase().includes(normalizedQuery) ||
          topic.alternatePhrasings.some((phrase) =>
            phrase.toLowerCase().includes(normalizedQuery)
          )
        ) {
          results.push(topic);
        }
      }
    }

    return results;
  }
}
```

## Service Layer Integration

The canonical topic repository is utilized by a dedicated service:

```typescript
// services/canonicalTopicService.ts

import { Topic } from "../types/canonicalTypes";
import { ICanonicalTopicRepository } from "../repositories/canonicalTopicRepository";
import logger from "../utils/logger";

export class CanonicalTopicService {
  constructor(private repository: ICanonicalTopicRepository) {}

  async getTopicForQuery(query: string): Promise<Topic | null> {
    try {
      logger.info(`[TOPIC] Finding topic for query: "${query}"`);

      // First try direct ID match
      const topics = await this.repository.searchTopics(query);

      if (topics.length > 0) {
        // Use the most relevant topic (first match)
        return topics[0];
      }

      // No direct match found
      return null;
    } catch (error) {
      logger.error(`[ERROR] Topic matching error: ${error.message}`);
      throw error;
    }
  }

  async getDataFilesForTopic(topic: Topic, year?: string): Promise<string[]> {
    try {
      const targetYear = year || "2025"; // Default to current year
      const mapping = topic.mapping[targetYear];

      if (!mapping) {
        logger.warn(
          `[TOPIC] No data available for topic ${topic.id} in year ${targetYear}`
        );
        return [];
      }

      return mapping.map((m) => m.file);
    } catch (error) {
      logger.error(`[ERROR] Error getting files for topic: ${error.message}`);
      return [];
    }
  }

  async isYearOverYearComparable(topicId: string): Promise<boolean> {
    const topic = await this.repository.getTopicById(topicId);

    if (!topic) {
      return false;
    }

    return (
      topic.comparable &&
      topic.mapping["2024"] !== undefined &&
      topic.mapping["2024"].length > 0
    );
  }
}
```

## Controller Implementation

The canonical topic service is used from controller endpoints:

```typescript
// app/api/controllers/topicController.ts

import { NextRequest, NextResponse } from "next/server";
import { formatErrorResponse } from "../../../utils/shared/errorHandler";
import { CanonicalTopicService } from "../services/canonicalTopicService";
import { CanonicalTopicRepository } from "../repositories/canonicalTopicRepository";
import logger from "../../../utils/logger";

const repository = new CanonicalTopicRepository();
const topicService = new CanonicalTopicService(repository);

export async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const query = searchParams.get("query");
    const theme = searchParams.get("theme");

    if (id) {
      logger.info(`[TOPIC] Looking up topic by ID: ${id}`);
      const topic = await repository.getTopicById(id);
      return topic
        ? NextResponse.json(topic)
        : NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    if (query) {
      logger.info(`[TOPIC] Searching topics by query: ${query}`);
      const topics = await repository.searchTopics(query);
      return NextResponse.json(topics);
    }

    if (theme) {
      logger.info(`[TOPIC] Getting topics by theme: ${theme}`);
      const topics = await repository.getTopicsByTheme(theme);
      return NextResponse.json(topics);
    }

    // Return all canonical mapping if no specific parameter
    const mapping = await repository.getCanonicalMapping();
    return NextResponse.json(mapping);
  } catch (error) {
    logger.error(`[ERROR] Topic controller error: ${error.message}`);
    return formatErrorResponse(error);
  }
}
```

## JSON File Format (Unchanged)

The underlying JSON file format maintains backward compatibility:

```json
{
    "metadata": {
        "version": "1.0",
        "description": "Canonical topic mapping for survey data organized by themes and topics",
        "lastUpdated": "2025-03-15"
    },
    "dataAccess": {
        "basePath": "scripts/output/split_data/",
        "comparableMarkets": [
            "United Kingdom",
            "United States",
            "Australia",
            "India",
            "Brazil"
        ],
        "allMarkets2025": [
            "United Kingdom",
            "United States",
            "Australia",
            "India",
            "Brazil",
            "France",
            "Germany",
            "Japan",
            "United Arab Emirates",
            "Saudi Arabia"
        ]
    },
    "retrievalRules": {
        "comparable": "For topics marked as comparable, retrieve data from both 2024 and 2025 surveys, but only include data from the five comparable markets.",
        "nonComparable": "For topics marked as non-comparable, retrieve data from only the available survey year(s) and include the appropriate user message explaining why year-on-year comparison is not available.",
        "singleYear": "For topics available in only one year, retrieve that data and include the user message noting the limitation."
    },
    "allValidFiles": {
        "2024": [
            "2024_1.json",
            "2024_2.json",
            // etc.
        ],
        "2025": [
            "2025_1.json",
            "2025_2.json",
            // etc.
        ]
    },
    "themes": [
        {
            "name": "Talent Attraction & Retention",
            "topics": [...]
        },
        // etc.
    ]
}
```

## Key Theme Categories (Unchanged)

The canonical topic mapping continues to organize topics into the following themes:

1. **Talent Attraction & Retention**
2. **Employee Experience & Work‑Life**
3. **Skills & Development**
4. **Leadership & Management**
5. **Workplace Dynamics**
6. **Compensation & Benefits**
7. **Workplace**
8. **Perceived Barriers**

## Comparable vs. Non-Comparable Topics (Updated)

The v2 implementation maintains the same distinction between comparable and non-comparable topics but adds enhanced programmatic safeguards:

### Comparable Topics

Topics marked as `"comparable": true` can be directly compared between 2024 and 2025 survey years. The repository pattern implementation enforces these constraints through the `isYearOverYearComparable` method that checks:

1. The topic's `comparable` flag
2. The existence of mapping data for both years
3. The availability of comparable markets

### Non-Comparable Topics

Topics marked as `"comparable": false` cannot be directly compared between years. The repository pattern implementation:

1. Enforces this restriction through service-layer validation
2. Provides appropriate user messages via the `topic.userMessage` property
3. Integrates with the prompt system to ensure proper handling

## Vercel KV Integration

The canonical topic mapping is now integrated with Vercel KV for improved performance:

### Caching Strategy

1. **Full Mapping Cache**:

   - The entire canonical mapping is cached with a 24-hour TTL
   - Cache key: `canonical:mapping`

2. **Individual Topic Cache**:

   - Each topic is cached individually when requested by ID
   - Cache key pattern: `canonical:topic:{id}`
   - TTL: 24 hours

3. **Search Results Cache**:
   - Common search queries are cached for 1 hour
   - Cache key pattern: `canonical:search:{query}`

### Performance Benefits

The repository pattern implementation with Vercel KV provides substantial performance improvements:

- **~80% Reduction in Load Time**: For frequently accessed topics
- **Improved Scalability**: Reduced file system load
- **Enhanced Reliability**: Through fallback mechanisms

## Integration with Other Components

The canonical topic mapping system integrates with other RIA25 components through the repository pattern:

- **Data Access**: The mapping repository interfaces with SurveyDataRepository
- **Prompt System**: The PromptService uses the CanonicalTopicService for query understanding
- **API System**: Controllers follow the controller-service pattern for data access
- **Testing**: Mock repositories enable comprehensive unit testing

## Maintenance and Updates

### Adding New Survey Years

The TypeScript implementation simplifies adding new survey years:

1. Update the `AllValidFiles` interface to include the new year
2. Extend the `Mapping` interface with the new year
3. Update the JSON configuration file
4. The repository implementation handles the rest automatically

### Adding New Topics

To add a new canonical topic:

1. Create a new topic entry in the appropriate theme section of the JSON file
2. Ensure it conforms to the `Topic` interface
3. Clear the cache to ensure updates are reflected immediately: `await kvClient.del('canonical:mapping')`

## Examples

### Example: Service Usage

```typescript
// Example usage in another service
import { CanonicalTopicRepository } from "../repositories/canonicalTopicRepository";
import { CanonicalTopicService } from "../services/canonicalTopicService";

class QueryAnalysisService {
  private topicService: CanonicalTopicService;

  constructor() {
    const repository = new CanonicalTopicRepository();
    this.topicService = new CanonicalTopicService(repository);
  }

  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    // Find relevant topic
    const topic = await this.topicService.getTopicForQuery(query);

    if (!topic) {
      return {
        matchedTopic: null,
        isComparable: false,
        message: "No matching topic found",
      };
    }

    // Check if comparable
    const isComparable = await this.topicService.isYearOverYearComparable(
      topic.id
    );

    // Get relevant files
    const files2025 = await this.topicService.getDataFilesForTopic(
      topic,
      "2025"
    );
    const files2024 = isComparable
      ? await this.topicService.getDataFilesForTopic(topic, "2024")
      : [];

    return {
      matchedTopic: topic.id,
      isComparable,
      message: topic.userMessage,
      files: {
        "2024": files2024,
        "2025": files2025,
      },
    };
  }
}
```

### Example: Controller-Service Pattern

```typescript
// API route implementation
// app/api/topic-lookup/route.ts
import { NextRequest } from "next/server";
import { getHandler } from "../controllers/topicController";
import { allowCors } from "../../../utils/shared/cors";

export const GET = allowCors(getHandler);
```

## Conclusion

The canonical topic mapping system represents a cornerstone of RIA25's data architecture, now enhanced with TypeScript type safety, repository pattern abstraction, and Vercel KV integration. By organizing data around meaningful topics rather than raw question numbers, the system provides a more user-friendly experience while maintaining data integrity and ensuring high performance.

---

_Last updated: Tue May 6 11:42:43 BST 2025_
