/**
 * Core Query Processing Logic
 * 
 * This module contains the core logic for processing user queries,
 * extracting from duplicated implementations in retrieval.js and
 * dataRetrievalService.js.
 * 
 * This implementation centralizes the core functionality while
 * allowing service-specific orchestration to remain separate.
 * 
 * References:
 * - Implementation Plan: utils/data/IMPLEMENTATION_PLAN.md
 * - Duplication Analysis: utils/data/analysis/Function-Duplication-Analysis.md
 * 
 * Last Updated: Wed Jul 3 2024
 */

import { normalizeQuery, isComparisonQuery, isStarterQuestion } from '../shared/queryUtils';
import logger from '../logger';
import * as fileUtils from '../fileUtils';
import { identifyRelevantFiles } from './retrieval';
import { filterRelevantSegments } from '../data/dataFiltering';
import { updateFileWithFilteredData } from '../data/fileProcessing';

/**
 * Core processing logic for handling queries and retrieving relevant data
 * 
 * @param query User's query string
 * @param params Configuration parameters
 * @param params.threadId Thread identifier for context
 * @param params.isFollowUp Whether this is a follow-up question
 * @param params.cachedFileIds Previously identified file IDs (for follow-ups)
 * @param params.cachedSegmentLabels Previously identified segment labels
 * @param params.comparisonContext Pre-existing comparison context
 * @param params.starterQuestionFallback Data to use for starter questions
 * @returns Object containing processed data and metadata
 */
export async function processQueryDataCore(
  query: string,
  params: {
    threadId?: string,
    isFollowUp?: boolean,
    cachedFileIds?: string[],
    cachedSegmentLabels?: string[],
    comparisonContext?: any,
    starterQuestionFallback?: any,
    userMetadata?: any
  }
) {
  const {
    threadId,
    isFollowUp = false,
    cachedFileIds = [],
    cachedSegmentLabels = [],
    comparisonContext,
    starterQuestionFallback,
    userMetadata
  } = params;

  // Normalize and validate query
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    logger.warn('Empty query received in processQueryDataCore');
    return { context: [], earlyReturn: true };
  }

  // Debug logging
  logger.debug(`[processQueryDataCore] Processing query: ${normalizedQuery}`);
  logger.debug(`[processQueryDataCore] ThreadId: ${threadId || 'none'}, isFollowUp: ${isFollowUp}`);
  logger.debug(`[processQueryDataCore] Cached fileIds: ${cachedFileIds.length > 0 ? cachedFileIds.join(',') : 'none'}`);

  // Handle starter questions if detected
  if (isStarterQuestion(normalizedQuery) && starterQuestionFallback) {
    logger.info('[processQueryDataCore] Detected starter question, using fallback data');
    return {
      context: starterQuestionFallback,
      isStarterQuestion: true,
      normalizedQuery
    };
  }

  // Detect comparison queries
  const isComparison = isComparisonQuery(normalizedQuery);
  logger.debug(`[processQueryDataCore] Comparison query detected: ${isComparison}`);

  // Use existing comparison context if available
  if (isComparison && comparisonContext) {
    logger.info('[processQueryDataCore] Using existing comparison context');
    return {
      context: comparisonContext,
      normalizedQuery,
      isComparisonQuery: true
    };
  }

  // Identify relevant files
  const relevantFiles = isFollowUp && cachedFileIds.length > 0
    ? await fileUtils.loadFilesById(cachedFileIds)
    : await identifyRelevantFiles(normalizedQuery, threadId);

  if (!relevantFiles || relevantFiles.length === 0) {
    logger.warn('[processQueryDataCore] No relevant files identified');
    return {
      context: [],
      normalizedQuery,
      noRelevantFiles: true
    };
  }

  // Filter segments for each file
  const processedFiles = await Promise.all(
    relevantFiles.map(async (file) => {
      const filteredSegments = await filterRelevantSegments(file, normalizedQuery, {
        cachedSegmentLabels: isFollowUp ? cachedSegmentLabels : [],
        isComparisonQuery: isComparison,
        threadId,
        userData: userMetadata
      });

      return updateFileWithFilteredData(file, filteredSegments);
    })
  );

  // Return processed data
  return {
    context: processedFiles,
    normalizedQuery,
    fileIds: processedFiles.map(file => file.id),
    segmentLabels: processedFiles.flatMap(file => 
      file.segments.map(segment => segment.label)
    ),
    isComparisonQuery: isComparison
  };
} 