// I created this route to get my updates working, I left the others just in case - they're not being used in the embed page though.
// This repo got me started: https://github.com/Superexpert/openai-assistant-starter-kit

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Stream } from "openai/streaming";
import readline from "readline";
import fs from 'fs';
import path from 'path';
import logger from "../../../utils/logger";

import { DEFAULT_SEGMENTS } from "../../../utils/data/segment_keys";
// Add import for retrieval system
import { processQueryWithData, identifyRelevantFiles, getPrecompiledStarterData, isStarterQuestion } from "../../../utils/openai/retrieval";

// Add import for cache utilities
import { getCachedFilesForThread, updateThreadCache } from "../../../utils/cache-utils";


// Centralized mode check
const isDirectMode = process.env.FILE_ACCESS_MODE === 'direct';
// Force standard mode for data retrieval
const forceStandardMode = true; // Force standard mode to ensure data retrieval works

// [ENV] FILE_ACCESS_MODE is set to: '${process.env.FILE_ACCESS_MODE}'
// [MODE] Running in ${isDirectMode ? 'DIRECT (file IDs only)' : 'STANDARD (processed data)'} mode

// Skip data extraction entirely in DIRECT mode
// We skip file retrieval and data extraction in DIRECT mode - the assistant will do that itself
// In STANDARD mode, we still retrieve and process data before sending to the assistant

// Configure OpenAI with reasonable defaults
const OPENAI_TIMEOUT_MS = 90000; // 90 seconds

// NOTE: We're now using Node.js runtime rather than Edge to allow for filesystem access
// If you deploy to Vercel, ensure your plan supports Node.js API routes

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * Sanitizes the output from OpenAI to remove embedded citation markers
 */
function sanitizeOutput(text: string): string {
  // Use the simpler version from staging: only remove [[n](#source)] style citations
  // This avoids collapsing whitespace which breaks markdown.
  return String(text || '').replace(/\[\[(\d+)\]\(#.*?\)\]/g, "");
}

/**
 * Determines if the message content is likely a valid JSON string
 */
function isJsonContent(content: string): boolean {
  if (typeof content !== 'string') return false;
  
  // Try to parse as JSON
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === 'object';
  } catch {
    return false; 
  }
}

/**
 * Logs performance metrics in a consistent format for testing
 */
function logPerformanceMetrics(stage, metrics) {
  logger.info(`----- ${stage} -----`);
  Object.entries(metrics).forEach(([key, value]) => {
    logger.info(`${key}: ${value}`);
  });
  logger.info("---------------------");
}

/**
 * Logs performance metrics to the performance_metrics.log file asynchronously
 */
function logPerformanceToFile(query, cachedFileIds, fileIds, pollCount, totalTimeMs, status, message = '') {
  if (process.env.VERCEL) return; // Skip file logging on Vercel
  // Create the log entry first, before any IO
  const logDir = path.join(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'performance_metrics.log');
  
  // Format the log entry (query | cachedFileIds | fileIds | pollCount | responseTime | status | timestamp)
  const cachedFileIdsStr = Array.isArray(cachedFileIds) ? cachedFileIds.join(',') : '';
  const fileIdsStr = Array.isArray(fileIds) ? fileIds.join(',') : '';
  const timestamp = new Date().toISOString();
  
  const logEntry = `${query.substring(0, 100)} | ${cachedFileIdsStr} | ${fileIdsStr} | ${pollCount} | ${totalTimeMs} | ${status} | ${timestamp}\n`;
  
  // Don't block the main thread - use async file operations
  // This is not awaited, so it won't block the response
  fs.promises.mkdir(logDir, { recursive: true })
    .then(() => fs.promises.appendFile(logFile, logEntry))
    .then(() => {
      // Only log success at debug level
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`Performance metrics saved to ${logFile}`);
      }
    })
    .catch(error => {
      logger.error('Error writing to performance log:', error);
    });
}

/**
 * Waits until there are no active runs on the thread.
 * Active statuses: "queued", "in_progress", "requires_action"
 */
async function waitForNoActiveRuns(openai: OpenAI, threadId: string, pollInterval = 250, timeoutMs = 60000) {
  const activeStatuses = new Set(["queued", "in_progress", "requires_action"]);
  const start = Date.now();
  while (true) {
    const runs = await openai.beta.threads.runs.list(threadId, { limit: 10 });
    const activeRun = runs.data.find(run => activeStatuses.has(run.status));
    if (!activeRun) break;
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timeout waiting for previous run to complete on thread " + threadId);
    }
    await new Promise(res => setTimeout(res, pollInterval));
  }
}

/**
 * Logs starter question invocations to a log file asynchronously.
 */
async function logStarterQuestionInvocation({
  starterQuestionCode,
  question,
  assistantId,
  threadId,
  dataFiles,
  stats,
  timestamp = new Date().toISOString()
}) {
  if (process.env.VERCEL) return; // Skip file logging on Vercel
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'starter_question_invocations.log');
    const logEntry = JSON.stringify({
      timestamp,
      starterQuestionCode,
      question,
      assistantId,
      threadId,
      dataFiles,
      stats
    }) + '\n';
    await fs.promises.mkdir(logDir, { recursive: true });
    await fs.promises.appendFile(logFile, logEntry, 'utf8');
  } catch (err) {
    logger.error('Error writing starter question invocation log:', err);
  }
}

// post a new message and stream OpenAI Assistant response
export async function POST(request: NextRequest) {
  try {
    // Performance tracking
    const apiStartTime = Date.now();
    let perfTimings = {
      requestStart: apiStartTime,
      runCreated: 0,
      pollStart: 0,
      firstPoll: 0,
      messageReceived: 0,
      totalTime: 0,
      pollingInterval: 250 // Current setting - for tracking changes
    };
    
    // Parse the request body
    const body = await request.json();
    let { assistantId, threadId, content } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Missing required field: content" },
        { status: 400 }
      );
    }

    //
    // ... rest of the POST function ...
  } catch (error) {
    logger.error("Error in POST handler:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}

// ... existing code ...