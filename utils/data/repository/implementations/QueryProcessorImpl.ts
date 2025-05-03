/**
 * QueryProcessor Implementation
 *
 * Implements the QueryProcessor interface for processing queries against data.
 * Handles query analysis, data retrieval, and response formatting.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#queryprocessor-core-function
 * - Analysis: ../analysis/QueryProcessor-Analysis.md#1-processquerywithdata
 * - Interface: ../interfaces/QueryProcessor.ts
 *
 * Last Updated: Sat May 25 2025
 */

import { 
  QueryProcessor, 
  ProcessedQueryResult, 
  QueryProcessingOptions 
} from '../interfaces/QueryProcessor';
import { QueryContext } from '../interfaces/QueryContext';
import { 
  DataFile, 
  FileRepository,
  FileIdentificationResult,
  FileRetrievalOptions
} from '../interfaces/FileRepository';
import { 
  parseQueryIntent as parseQueryIntentImpl, 
  filterDataBySegments as filterDataBySegmentsImpl
} from './SmartFiltering';
import { QueryIntent, FilterResult } from '../interfaces/FilterProcessor';

/**
 * Implementation of the QueryProcessor interface
 */
export class QueryProcessorImpl implements QueryProcessor {
  private fileRepository: FileRepository;
  private startTime: number = 0;

  /**
   * Constructor
   * 
   * @param fileRepository The file repository to use for data access
   */
  constructor(fileRepository: FileRepository) {
    this.fileRepository = fileRepository;
  }

  /**
   * Process a query against available data
   * 
   * Core implementation that handles the complete flow from query analysis 
   * to data retrieval and formatting.
   * 
   * @param context The query context containing the query and related information
   * @param options Processing options to customize behavior
   * @returns Promise resolving to the processed query result
   */
  async processQueryWithData(
    context: QueryContext,
    options?: QueryProcessingOptions
  ): Promise<ProcessedQueryResult> {
    // Start timing for metrics
    this.startTime = Date.now();
    
    try {
      // Initialize result with enhanced context (clone to avoid modifying original)
      const enhancedContext = context.clone();
      
      // Early return for empty queries
      if (!context.query || context.query.trim() === '') {
        return this.createEmptyResult(enhancedContext, 'Empty query');
      }
      
      // Parse query intent if not already available
      if (!enhancedContext.queryIntent) {
        enhancedContext.queryIntent = this.parseQueryIntent(context.query);
      }
      
      // Extract segments if not provided
      if (!enhancedContext.segmentTracking.requestedSegments.length) {
        enhancedContext.segmentTracking.requestedSegments = this.extractSegmentsFromQuery(context.query);
      }

      // Detect query characteristics
      const isComparison = this.isComparisonQuery(context.query);
      const isStarterQuestion = this.isStarterQuestion(context.query);
      
      // Modify options based on query characteristics
      const processingOptions = this.prepareProcessingOptions(options, isComparison, isStarterQuestion);
      
      // Handle starter questions which may have special data requirements
      if (isStarterQuestion && processingOptions.starterQuestionStrategy !== 'never') {
        return this.processStarterQuestion(enhancedContext, processingOptions);
      }
      
      // Get relevant files (either from cache or by identifying new ones)
      const relevantFiles = await this.getRelevantFiles(enhancedContext, processingOptions);
      
      // Early return if no relevant files found
      if (relevantFiles.length === 0) {
        return this.createEmptyResult(enhancedContext, 'No relevant files found');
      }
      
      // Load detailed file data for processing
      const fileData = await this.loadFileData(relevantFiles, enhancedContext, processingOptions);
      
      // Process the data based on query and context
      const processedData = await this.processData(fileData, enhancedContext, processingOptions);
      
      // Build the final result
      return this.buildResult(processedData, fileData, enhancedContext, {
        isComparison,
        isStarterQuestion,
        processingTimeMs: Date.now() - this.startTime,
        fileCount: fileData.length,
        segmentCount: this.countSegments(fileData)
      });
    } catch (error) {
      console.error('Error processing query:', error);
      
      // Create error result
      return this.createErrorResult(
        context,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Determine if a query is asking for a comparison between data
   * 
   * Analyzes query text for patterns indicating comparison intent.
   * 
   * @param query The query text to analyze
   * @returns Whether the query is a comparison query
   */
  isComparisonQuery(query: string): boolean {
    if (!query) return false;
    
    // Normalize the query
    const normalizedQuery = query.toLowerCase().trim();
    
    // Year-specific comparison patterns
    const yearComparisonPatterns = [
      /compare.*2024.*2025/i,
      /compare.*2025.*2024/i,
      /difference.*between.*2024.*2025/i,
      /difference.*between.*2025.*2024/i,
      /compare with 2024/i,
      /compare with 2025/i,
      /compare to 2024/i,
      /compare to 2025/i,
      /2024 vs 2025/i,
      /2025 vs 2024/i,
      /2024 versus 2025/i,
      /2025 versus 2024/i,
      /2024 compared to 2025/i,
      /2025 compared to 2024/i,
      /between 2024 and 2025/i,
      /between 2025 and 2024/i,
    ];
    
    // Generic comparison patterns
    const genericComparisonPatterns = [
      /\bcompare\b/i,
      /\bcompared\b/i,
      /\bcomparison\b/i,
      /\bversus\b|\bvs\b/i,
      /\bdifference\b|\bdifferences\b/i,
      /change(d|s)? (from|since|over|between)/i,
      /\bhow\b.*\bchange(d|s)?\b/i,
      /\bwhat\b.*\bchange(d|s)?\b/i,
      /\bhigher\b|\blower\b/i,
      /\bincrease(d)?\b|\bdecrease(d)?\b/i,
    ];
    
    // Check year-specific patterns first
    for (const pattern of yearComparisonPatterns) {
      if (pattern.test(normalizedQuery)) {
        return true;
      }
    }
    
    // Check generic patterns if no year-specific match
    for (const pattern of genericComparisonPatterns) {
      if (pattern.test(normalizedQuery)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Determine if a query is a starter question
   * 
   * Identifies queries that are general or introductory in nature.
   * 
   * @param query The query text to analyze
   * @returns Whether the query is a starter question
   */
  isStarterQuestion(query: string): boolean {
    if (!query) return false;
    
    // Normalize the query
    const normalizedQuery = query.toLowerCase().trim();
    
    // Starter question patterns
    const starterPatterns = [
      /\bwhat are\b.*\bkey\b|\bimportant\b|\bmain\b.*\b(points|topics|facts|insights|findings)\b/i,
      /\bwhat is\b.*\boverview\b/i,
      /\bgive me an overview\b/i,
      /\bsummarize\b/i,
      /\bsummary\b/i,
      /\bhighlights\b/i,
      /\bwhat should i know\b/i,
      /\bwhat do i need to know\b/i,
      /\btell me about\b/i,
      /\btell me more\b/i,
      /\bintroduction\b/i,
      /\bintroduce me\b/i,
      /\bexplain\b/i,
      /\bwhat are\b/i,
      /\bhow would you describe\b/i,
      /\bprovide context\b/i,
    ];
    
    // Check for starter patterns
    for (const pattern of starterPatterns) {
      if (pattern.test(normalizedQuery)) {
        return true;
      }
    }
    
    // Short queries (less than 5 words) are often general questions
    const wordCount = normalizedQuery.split(/\s+/).filter(Boolean).length;
    if (wordCount < 5) {
      return true;
    }
    
    return false;
  }

  /**
   * Parse query intent from a user query and conversation history
   * 
   * @param query The query text to analyze
   * @param conversationHistory Optional conversation history for follow-up detection
   * @returns Parsed query intent
   */
  parseQueryIntent(query: string, conversationHistory?: any[]): QueryIntent {
    return parseQueryIntentImpl(query, conversationHistory);
  }
  
  /**
   * Filter data by specified segments
   * 
   * @param data Data files to filter
   * @param segments Segments to filter by
   * @returns Filtered data result
   */
  filterDataBySegments(data: any, segments: string[]): FilterResult {
    return filterDataBySegmentsImpl(data, segments);
  }

  /**
   * Extract segments mentioned in a query
   * 
   * Analyzes the query text for mentions of specific data segments,
   * such as demographic information or time periods.
   * 
   * @param query The query text to analyze
   * @returns Array of segment identifiers mentioned in the query
   */
  extractSegmentsFromQuery(query: string): string[] {
    if (!query) return [];
    
    // Basic implementation matches key terms to known segment types
    const detectedSegments: string[] = [];
    const normalizedQuery = query.toLowerCase().trim();
    
    // Demographic segments
    const segmentPatterns = {
      region: [/\bcountry\b|\bcountries\b|\bregion\b|\bregions\b|\block\w*\b|\bgeograph\w*\b/i],
      gender: [/\bgender\b|\bmale\b|\bfemale\b|\bmen\b|\bwomen\b|\bnon-binary\b/i],
      age: [/\bage\b|\bage group\b|\bage range\b|\byoung\w*\b|\bold\w*\b|\bgeneration\b/i],
      org_size: [/\bcompany size\b|\borganization size\b|\bemployee count\b|\bworkforce size\b/i],
      sector: [/\bsector\b|\bindustry\b|\bfield\b/i],
      job_level: [/\bjob level\b|\bsenior\w*\b|\bjunior\b|\bexecutive\b|\bmanager\w*\b|\bc-suite\b|\bdirector\b/i],
      relationship_status: [/\brelationship\b|\bmarried\b|\bsingle\b|\bdivorced\b/i],
      education: [/\beducation\b|\bdegree\b|\bcollege\b|\buniversity\b|\bacademic\b/i],
      employment_status: [/\bemployment\b|\bemployed\b|\bunemployed\b|\bfull-time\b|\bpart-time\b/i],
    };
    
    // Check for each segment pattern
    for (const [segment, patterns] of Object.entries(segmentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedQuery)) {
          detectedSegments.push(segment);
          break;
        }
      }
    }
    
    return detectedSegments;
  }

  /**
   * Process a starter question
   * 
   * Special handling for overview/introductory questions.
   * 
   * @param context The query context
   * @param options Processing options
   * @returns The processed query result
   */
  private async processStarterQuestion(
    context: QueryContext,
    options: QueryProcessingOptions
  ): Promise<ProcessedQueryResult> {
    // Clone context for modification
    const enhancedContext = context.clone();
    
    // Prioritize summary segments for starter questions
    const starterSegments = ['summary', 'executive_summary', 'introduction', 'overview'];
    const fileOptions: FileRetrievalOptions = {
      requiredSegments: starterSegments,
      cacheStrategy: 'use-cache'
    };
    
    // Get relevant files
    const relevantFiles = await this.getRelevantFiles(enhancedContext, options);
    
    // Early return if no relevant files found
    if (relevantFiles.length === 0) {
      return this.createEmptyResult(enhancedContext, 'No relevant files found for starter question');
    }
    
    // Load files with starter-specific segments
    const fileData = await this.fileRepository.getFilesByIds(
      relevantFiles,
      fileOptions
    );
    
    // Create a simplified, focused result for starter questions
    const processedData = {
      type: 'starter_question',
      summaries: this.extractSummariesFromFiles(fileData),
      suggestedTopics: this.generateSuggestedTopics(fileData, context.query)
    };
    
    // Build result
    return this.buildResult(processedData, fileData, enhancedContext, {
      isComparison: false,
      isStarterQuestion: true,
      processingTimeMs: Date.now() - this.startTime,
      fileCount: fileData.length,
      segmentCount: this.countSegments(fileData)
    });
  }

  /**
   * Get relevant files based on context
   * 
   * Either uses cached files or identifies new ones based on the query.
   * 
   * @param context The query context
   * @param options Processing options
   * @returns Array of relevant file IDs
   */
  private async getRelevantFiles(
    context: QueryContext,
    options: QueryProcessingOptions
  ): Promise<string[]> {
    // Start with cached files if available and this is a follow-up
    if (context.isFollowUp && context.cachedFileIds && context.cachedFileIds.length > 0) {
      return context.cachedFileIds;
    }
    
    // Identify relevant files based on the query
    const fileOptions: FileRetrievalOptions = {};
    
    // Add segment compatibility if we extracted segments
    const querySegments = this.extractSegmentsFromQuery(context.query);
    if (querySegments.length > 0) {
      fileOptions.compatibility = {
        segments: querySegments
      };
    }
    
    // Identify relevant files
    const result = await this.fileRepository.getFilesByQuery(context, fileOptions);
    
    // Limit the number of files if specified
    let relevantFiles = result.relevantFiles;
    if (options.maxFiles && relevantFiles.length > options.maxFiles) {
      relevantFiles = relevantFiles.slice(0, options.maxFiles);
    }
    
    // Update context with identified files
    context.relevantFiles = relevantFiles;
    
    return relevantFiles;
  }

  /**
   * Load detailed file data for the relevant files
   * 
   * @param fileIds Array of file IDs to load
   * @param context Query context
   * @param options Processing options
   * @returns Array of loaded data files
   */
  private async loadFileData(
    fileIds: string[],
    context: QueryContext,
    options: QueryProcessingOptions
  ): Promise<DataFile[]> {
    // Determine which segments to load
    let requiredSegments: string[] = [];
    
    // Extract segments from query
    const querySegments = this.extractSegmentsFromQuery(context.query);
    
    // Combine with priority segments from options
    if (options.prioritySegments && options.prioritySegments.length > 0) {
      requiredSegments = [...new Set([...querySegments, ...options.prioritySegments])];
    } else if (querySegments.length > 0) {
      requiredSegments = querySegments;
    }
    
    // File retrieval options
    const fileOptions: FileRetrievalOptions = {
      requiredSegments: requiredSegments.length > 0 ? requiredSegments : undefined,
      cacheStrategy: 'use-cache'
    };
    
    // Load files
    return this.fileRepository.getFilesByIds(fileIds, fileOptions);
  }

  /**
   * Process the loaded data based on query and context
   * 
   * @param files Loaded file data
   * @param context Query context
   * @param options Processing options
   * @returns Processed data ready for response
   */
  private async processData(
    files: DataFile[],
    context: QueryContext,
    options: QueryProcessingOptions
  ): Promise<any> {
    // For comparison queries
    if (this.isComparisonQuery(context.query) && options.comparisonStrategy !== 'disabled') {
      return this.processComparisonData(files, context);
    }
    
    // Check if we need to filter by segments
    if (context.segmentTracking?.requestedSegments?.length > 0) {
      const filesData = { files };
      const filteredData = this.filterDataBySegments(
        filesData, 
        context.segmentTracking.requestedSegments
      );
      
      // Update context with found/missing segments
      if (filteredData.foundSegments) {
        context.segmentTracking.currentSegments = filteredData.foundSegments;
      }
      
      // Return filtered data
      return {
        stats: filteredData.stats,
        filteredData: filteredData.filteredData,
        summary: filteredData.summary,
        foundSegments: filteredData.foundSegments,
        missingSegments: filteredData.missingSegments,
        queryContext: {
          query: context.query,
          isFollowUp: context.isFollowUp,
          segments: context.segmentTracking.requestedSegments
        }
      };
    }
    
    // Default data processing
    return {
      files: files.map(file => ({
        id: file.id,
        metadata: file.metadata,
        segments: Object.keys(file.segments),
      })),
      context: {
        query: context.query,
        isFollowUp: context.isFollowUp,
        relevantFiles: context.relevantFiles
      }
    };
  }

  /**
   * Process data for comparison queries
   * 
   * @param files Loaded file data
   * @param context Query context
   * @returns Processed comparison data
   */
  private processComparisonData(files: DataFile[], context: QueryContext): any {
    // Simple placeholder implementation
    // In a real implementation, this would identify differences and similarities
    return {
      type: 'comparison',
      comparisonQuery: context.query,
      itemsCompared: files.map(file => file.id),
      differences: [],
      similarities: []
    };
  }

  /**
   * Build the final processed query result
   * 
   * @param data Processed data
   * @param files Files that contributed to the result
   * @param context Enhanced query context
   * @param metrics Processing metrics
   * @returns Complete processed query result
   */
  private buildResult(
    data: any,
    files: DataFile[],
    context: QueryContext,
    metrics: {
      isComparison: boolean;
      isStarterQuestion: boolean;
      processingTimeMs: number;
      fileCount: number;
      segmentCount: number;
    }
  ): ProcessedQueryResult {
    return {
      processedData: data,
      relevantFiles: files,
      enhancedContext: context,
      isComparison: metrics.isComparison,
      isStarterQuestion: metrics.isStarterQuestion,
      dataVersion: "v2",
      metrics: {
        processingTimeMs: metrics.processingTimeMs,
        fileCount: metrics.fileCount,
        segmentCount: metrics.segmentCount
      }
    };
  }

  /**
   * Create an empty result when no data is available
   * 
   * @param context Query context
   * @param reason Reason for the empty result
   * @returns Empty processed query result
   */
  private createEmptyResult(context: QueryContext, reason: string): ProcessedQueryResult {
    return {
      processedData: { 
        empty: true, 
        reason 
      },
      relevantFiles: [],
      enhancedContext: context,
      dataVersion: "v2",
      metrics: {
        processingTimeMs: Date.now() - this.startTime,
        fileCount: 0,
        segmentCount: 0
      }
    };
  }

  /**
   * Create an error result
   * 
   * @param context Query context
   * @param errorMessage Error message
   * @returns Error processed query result
   */
  private createErrorResult(context: QueryContext, errorMessage: string): ProcessedQueryResult {
    return {
      processedData: { 
        error: true, 
        message: errorMessage 
      },
      relevantFiles: [],
      enhancedContext: context,
      dataVersion: "v2",
      metrics: {
        processingTimeMs: Date.now() - this.startTime,
        fileCount: 0,
        segmentCount: 0
      }
    };
  }

  /**
   * Prepare processing options by merging defaults with provided options
   * 
   * @param options User-provided options
   * @param isComparison Whether the query is a comparison
   * @param isStarterQuestion Whether the query is a starter question
   * @returns Complete processing options
   */
  private prepareProcessingOptions(
    options?: QueryProcessingOptions,
    isComparison: boolean = false,
    isStarterQuestion: boolean = false
  ): QueryProcessingOptions {
    const defaultOptions: QueryProcessingOptions = {
      enablePatternDetection: true,
      starterQuestionStrategy: 'auto',
      comparisonStrategy: 'enhanced',
      maxFiles: 5,
      maxSegments: 10,
      prioritySegments: ['summary', 'executive_summary']
    };
    
    // Merge with user options
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Adjust based on query type
    if (isComparison && !options?.comparisonStrategy) {
      mergedOptions.comparisonStrategy = 'enhanced';
    }
    
    if (isStarterQuestion && !options?.starterQuestionStrategy) {
      mergedOptions.starterQuestionStrategy = 'auto';
    }
    
    return mergedOptions;
  }

  /**
   * Extract summaries from files
   * 
   * Helper for starter question processing
   * 
   * @param files Array of data files
   * @returns Collection of summaries extracted from files
   */
  private extractSummariesFromFiles(files: DataFile[]): any[] {
    const summaries: any[] = [];
    
    const summarySegments = ['summary', 'executive_summary', 'introduction', 'overview'];
    
    for (const file of files) {
      // Find the first available summary segment
      for (const segment of summarySegments) {
        if (file.segments[segment]) {
          summaries.push({
            fileId: file.id,
            title: file.metadata.title || file.id,
            summaryType: segment,
            content: file.segments[segment]
          });
          break; // Only get one summary per file
        }
      }
    }
    
    return summaries;
  }

  /**
   * Generate suggested topics based on file content
   * 
   * Helper for starter question processing
   * 
   * @param files Array of data files
   * @param query Original query
   * @returns Array of suggested topics
   */
  private generateSuggestedTopics(files: DataFile[], query: string): string[] {
    // Simple implementation - in reality, this would analyze file content
    // to suggest relevant follow-up topics
    const topics = new Set<string>();
    
    // Extract topics from metadata
    for (const file of files) {
      if (file.metadata.topics && Array.isArray(file.metadata.topics)) {
        file.metadata.topics.forEach((topic: string) => topics.add(topic));
      }
      
      if (file.metadata.keywords && Array.isArray(file.metadata.keywords)) {
        file.metadata.keywords.forEach((keyword: string) => topics.add(keyword));
      }
    }
    
    return Array.from(topics).slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Count the total number of segments across files
   * 
   * Helper for metrics calculation
   * 
   * @param files Array of data files
   * @returns Total segment count
   */
  private countSegments(files: DataFile[]): number {
    let count = 0;
    
    for (const file of files) {
      count += Object.keys(file.segments).length;
    }
    
    return count;
  }
}

export default QueryProcessorImpl; 