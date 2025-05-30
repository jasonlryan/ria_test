# RIA25 Prompt System Evolution

**Last Updated:** Tue May 6 11:37:01 BST 2025

> **Target Audience:** Developers, Prompt Engineers, System Architects  
> **Related Documents:**
>
> - 13_canonical_topic_reference.md
> - 06_system_architecture.md
> - 15_thread_data_management.md
> - 14_api_reference.md

## Introduction

This document outlines the development journey of the RIA25 prompt system, tracking its evolution from initial test questions to the final TypeScript-based system that powers the workforce insights assistant. The v2 update includes the integration of the repository pattern, TypeScript migration, and Vercel KV implementations for prompt handling and storage.

## Timeline of Development

### Initial Development (March-April 2024)

The first version of the RIA25 prompt system was developed in March-April 2024, focusing on:

- Establishing test questions and query parsing
- Developing segment detection refinements
- Implementing anti-fabrication testing
- Creating and finalizing the system prompt
- Building a starter question system for optimized performance

_Refer to the v1 documentation for detailed information about this phase._

### Repository Pattern Integration (October 2024 - February 2025)

Following the architectural decision to implement the repository pattern, the prompt system underwent significant refactoring:

1. **TypeScript Migration (October 2024)**:

   - Conversion of all prompt-related JavaScript files to TypeScript
   - Implementation of strong typing for prompt templates and configurations
   - Creation of interfaces for prompt data structures

2. **Prompt Repository Creation (November 2024)**:

   - Development of `PromptRepository` class to abstract prompt storage and retrieval
   - Implementation of Vercel KV integration for prompt caching
   - Fallback mechanisms for local development and testing

3. **Service Layer Implementation (December 2024)**:
   - Creation of `PromptService` to handle prompt processing logic
   - Integration with the controller-service architecture
   - Implementation of repository pattern best practices

### Prompt Repository Implementation

The repository pattern implementation for prompts focused on:

```typescript
// Definition of the prompt repository interface
interface IPromptRepository {
  getSystemPrompt(): Promise<SystemPrompt>;
  getStarterPrompt(code: string): Promise<StarterPrompt | null>;
  getCustomPrompt(type: string): Promise<CustomPrompt | null>;
  updateSystemPrompt(prompt: SystemPrompt): Promise<void>;
  // Additional methods...
}

// Implementation using Vercel KV
export class PromptRepository implements IPromptRepository {
  private kvClient: typeof import("@vercel/kv").kv;
  private fileSystem: FileSystemService;

  constructor(kvClient, fileSystem) {
    this.kvClient = kvClient;
    this.fileSystem = fileSystem;
  }

  async getSystemPrompt(): Promise<SystemPrompt> {
    const cacheKey = "prompts:system";

    try {
      // Try to get from KV cache first
      const cachedPrompt = await this.kvClient.get<SystemPrompt>(cacheKey);
      if (cachedPrompt) {
        return cachedPrompt;
      }

      // Fallback to file system
      const prompt = await this.fileSystem.readJsonFile<SystemPrompt>(
        "prompts/system_prompt.json"
      );

      // Cache for future use (1 hour TTL)
      await this.kvClient.set(cacheKey, prompt, { ex: 3600 });

      return prompt;
    } catch (error) {
      // Always fallback to file system on error
      return this.fileSystem.readJsonFile<SystemPrompt>(
        "prompts/system_prompt.json"
      );
    }
  }

  async getStarterPrompt(code: string): Promise<StarterPrompt | null> {
    const cacheKey = `prompts:starter:${code}`;

    try {
      // Try KV cache first
      const cachedPrompt = await this.kvClient.get<StarterPrompt>(cacheKey);
      if (cachedPrompt) {
        return cachedPrompt;
      }

      // Fallback to file system
      const promptPath = `utils/openai/precompiled_starters/${code}.json`;
      const exists = await this.fileSystem.exists(promptPath);

      if (!exists) {
        return null;
      }

      const prompt = await this.fileSystem.readJsonFile<StarterPrompt>(
        promptPath
      );

      // Cache for future use (24 hours TTL)
      await this.kvClient.set(cacheKey, prompt, { ex: 86400 });

      return prompt;
    } catch (error) {
      // Try file system on error
      try {
        return await this.fileSystem.readJsonFile<StarterPrompt>(
          `utils/openai/precompiled_starters/${code}.json`
        );
      } catch {
        return null;
      }
    }
  }

  // Other implementation methods...
}
```

## Service Layer for Prompt Management

The prompt service layer built on top of the repository:

```typescript
export class PromptService {
  private promptRepository: IPromptRepository;
  private queryService: QueryService;

  constructor(promptRepository: IPromptRepository, queryService: QueryService) {
    this.promptRepository = promptRepository;
    this.queryService = queryService;
  }

  async getPromptForQuery(query: string): Promise<ProcessedPrompt> {
    // Check if this is a starter question
    const starterCode = this.queryService.identifyStarterQuestion(query);

    if (starterCode) {
      const starterPrompt = await this.promptRepository.getStarterPrompt(
        starterCode
      );
      if (starterPrompt) {
        return this.processStarterPrompt(starterPrompt, query);
      }
    }

    // Standard query path
    const systemPrompt = await this.promptRepository.getSystemPrompt();
    return this.processSystemPrompt(systemPrompt, query);
  }

  private async processSystemPrompt(
    prompt: SystemPrompt,
    query: string
  ): Promise<ProcessedPrompt> {
    // Processing logic...
    return {
      template: prompt.template,
      variables: {
        // Variable mapping...
      },
    };
  }

  // Other methods...
}
```

## Controller Integration

The prompt system was integrated into the controller layer following the Controller-Service Architecture Standard:

```typescript
// app/api/controllers/promptController.ts
import { NextRequest, NextResponse } from "next/server";
import { formatErrorResponse } from "../../../utils/shared/errorHandler";
import PromptService from "../services/promptService";
import logger from "../../../utils/logger";

const promptService = new PromptService();

export async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "system";

    logger.info(`[PROMPT] Retrieving prompt type: ${type}`);

    const prompt = await promptService.getPrompt(type);

    return NextResponse.json(prompt);
  } catch (error) {
    logger.error(`[ERROR] Prompt controller error: ${error.message}`);
    return formatErrorResponse(error);
  }
}

// Other handlers...
```

## Prompt Compilation with TypeScript

The migration to TypeScript improved prompt management through:

1. **Type-Safe Prompt Templates**:

   - Definition of interfaces for all prompt types
   - Type checking for prompt variables and substitutions
   - Improved developer experience with IDE support

2. **Enhanced Error Handling**:
   - Early detection of template syntax errors
   - Type-safe access to prompt properties
   - Better error messages during prompt processing

```typescript
// Type definitions for prompts
interface SystemPrompt {
  template: string;
  rules: Rule[];
  sections: Section[];
  version: string;
}

interface StarterPrompt {
  starterQuestionCode: string;
  question: string;
  data_files: string[];
  segments: string[];
  matched_topics: string[];
  summary: string;
}

interface ProcessedPrompt {
  template: string;
  variables: Record<string, any>;
}

// Type-safe prompt processing
function substituteVariables(
  template: string,
  variables: Record<string, any>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    if (!(key in variables)) {
      throw new Error(`Missing variable: ${key}`);
    }
    return String(variables[key]);
  });
}
```

## Vercel KV Integration for Prompt Caching

The implementation of Vercel KV significantly improved prompt performance:

1. **Caching Strategy**:

   - System prompts cached with 1-hour TTL
   - Starter prompts cached with 24-hour TTL
   - Custom prompts cached with configurable TTLs

2. **Key Schema**:

   - System prompt: `prompts:system`
   - Starter prompts: `prompts:starter:{code}`
   - Custom prompts: `prompts:custom:{type}`

3. **Fallback Mechanism**:
   - Graceful degradation to file system on KV failure
   - Local development support with memory store

## Current Implementation (2025)

The current implementation features:

- **TypeScript-Based Prompt System**: All prompt-related code is now written in TypeScript with strong typing.
- **Repository Pattern**: Prompts are managed through the repository pattern, abstracting storage details.
- **Controller-Service Architecture**: Prompt handling follows the standard controller-service architecture.
- **Vercel KV Integration**: Prompts are cached in Vercel KV for improved performance.
- **Compatibility Layer**: Support for legacy JS code during the migration period.

### Performance Improvements

The repository pattern implementation with Vercel KV has yielded significant performance benefits:

- **~70% Reduction in Prompt Load Time**: Through caching frequently used prompts
- **Improved Reliability**: Through fallback mechanisms
- **Enhanced Development Experience**: Through type safety and better error handling
- **Simplified Testing**: Through repository mocking and dependency injection

## Starter Question System Enhancements

The starter question system has been enhanced with the repository pattern:

### TypeScript Implementation

```typescript
// interface for starter questions
interface StarterQuestion {
  code: string;
  question: string;
  dataFiles: string[];
  segments: string[];
  matchedTopics: string[];
  summary: string;
}

// Repository method
async getStarterQuestions(): Promise<Map<string, StarterQuestion>> {
  const cacheKey = 'prompts:starter:all';

  try {
    // Try to get from KV cache first
    const cached = await this.kvClient.get<Map<string, StarterQuestion>>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fallback to file system
    const files = await this.fileSystem.listFiles('utils/openai/precompiled_starters');
    const starterQuestions = new Map<string, StarterQuestion>();

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const code = file.replace('.json', '');
      const data = await this.fileSystem.readJsonFile<StarterQuestion>(`utils/openai/precompiled_starters/${file}`);
      starterQuestions.set(code, data);
    }

    // Cache for future use (1 hour TTL)
    await this.kvClient.set(cacheKey, starterQuestions, { ex: 3600 });

    return starterQuestions;
  } catch (error) {
    // Fallback to direct file system approach on error
    // Implementation details...
  }
}
```

### Performance Benefits

The enhanced starter question system now provides additional performance improvements:

- **Batch Loading**: All starter questions can be loaded in a single operation
- **Cached Management**: Question sets are cached for faster lookup
- **Typed Access**: TypeScript ensures type safety for starter question data
- **Improved Analytics**: Integration with Vercel Analytics for usage tracking

## Future Directions

Planned enhancements to the prompt system include:

1. **Automated Prompt Testing**: Implementing automated tests for prompt templates
2. **A/B Testing Infrastructure**: Supporting prompt experimentation with metrics
3. **Dynamic Prompt Generation**: Further optimization based on query patterns
4. **Enhanced Analytics Integration**: Deeper integration with usage metrics

---

_Last updated: Tue May 6 11:37:01 BST 2025_
