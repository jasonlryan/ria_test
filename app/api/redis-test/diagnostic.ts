import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import kvClient from '../../../utils/shared/kvClient';
import { getCachedFilesForThread, updateThreadCache, CachedFile } from '../../../utils/cache-utils';
import logger from '../../../utils/logger';

export async function GET(req: Request) {
  const results = {
    steps: [],
    fileSystem: { working: false, details: null },
    kvStorage: { working: false, details: null },
    kvRetrieval: { working: false, details: null },
    dataProcessing: { working: false, details: null },
    overall: { working: false, diagnosis: '', fix: '' }
  };

  try {
    // STEP 1: TEST FILESYSTEM ACCESS
    const dataDir = path.join(process.cwd(), "scripts", "output", "split_data");
    const testFileId = "2025_all_3"; // Using a sample file
    const filePath = path.join(dataDir, `${testFileId}.json`);
    
    let fileData = null;
    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        fileData = JSON.parse(fileContent);
        results.fileSystem = { 
          working: true, 
          details: { 
            path: filePath, 
            fileExists: true, 
            dataSize: fileContent.length,
            hasContent: !!fileData
          }
        };
        results.steps.push('File system access: SUCCESS');
      } else {
        results.fileSystem = { 
          working: false, 
          details: { 
            path: filePath, 
            fileExists: false, 
            error: 'File not found'
          }
        };
        results.steps.push('File system access: FAILED - File not found');
      }
    } catch (error) {
      results.fileSystem = { 
        working: false, 
        details: { 
          path: filePath, 
          error: error.message 
        }
      };
      results.steps.push(`File system access: FAILED - ${error.message}`);
    }

    // STEP 2: TEST KV STORAGE
    const testThreadId = `diagnostic-${Date.now()}`;
    const testObject = {
      test: 'KV storage test',
      timestamp: Date.now(),
      fileId: testFileId
    };

    try {
      // Store test object in KV
      await kvClient.set(`diagnostic:${testThreadId}`, testObject);
      
      // Store a small part of actual file data if we have it
      if (fileData) {
        const cachedFile: CachedFile = {
          id: testFileId,
          data: { 
            sample: fileData.responses ? fileData.responses.slice(0, 1) : { sample: 'data' } 
          },
          loadedSegments: new Set(['sample']),
          availableSegments: new Set(['sample'])
        };
        
        await updateThreadCache(testThreadId, [cachedFile]);
        
        results.kvStorage = {
          working: true,
          details: {
            threadId: testThreadId,
            storedKey: `diagnostic:${testThreadId}`,
            cachedFileId: testFileId
          }
        };
        results.steps.push('KV storage: SUCCESS');
      } else {
        results.kvStorage = {
          working: false,
          details: {
            threadId: testThreadId,
            error: 'Could not store file data - no source data available'
          }
        };
        results.steps.push('KV storage: PARTIAL - Test object stored, but no file data');
      }
    } catch (error) {
      results.kvStorage = {
        working: false,
        details: {
          error: error.message
        }
      };
      results.steps.push(`KV storage: FAILED - ${error.message}`);
    }

    // STEP 3: TEST KV RETRIEVAL
    try {
      // Retrieve test object from KV
      const retrievedTestObject = await kvClient.get(`diagnostic:${testThreadId}`);
      
      // Retrieve cached files from KV
      const cachedFiles = await getCachedFilesForThread(testThreadId);
      
      if (retrievedTestObject && JSON.stringify(retrievedTestObject) === JSON.stringify(testObject)) {
        results.kvRetrieval = {
          working: true,
          details: {
            retrievedTestObject,
            cachedFiles: cachedFiles.length > 0 ? {
              count: cachedFiles.length,
              sampleId: cachedFiles[0]?.id,
              hasData: !!cachedFiles[0]?.data?.sample
            } : 'No cached files'
          }
        };
        results.steps.push('KV retrieval: SUCCESS');
      } else {
        results.kvRetrieval = {
          working: false,
          details: {
            testObjectMatch: retrievedTestObject ? 
              JSON.stringify(retrievedTestObject) === JSON.stringify(testObject) : false,
            cachedFiles: cachedFiles.length,
            error: 'Data retrieved does not match stored data'
          }
        };
        results.steps.push('KV retrieval: FAILED - Retrieved data mismatch');
      }
    } catch (error) {
      results.kvRetrieval = {
        working: false,
        details: {
          error: error.message
        }
      };
      results.steps.push(`KV retrieval: FAILED - ${error.message}`);
    }

    // STEP 4: TEST DATA PROCESSING FOR ASSISTANT
    try {
      // Simulate the data processing that would happen before sending to assistant
      const cachedFiles = await getCachedFilesForThread(testThreadId);
      
      // This matches the structure that would be sent to the assistant
      const payload = {
        filteredData: [],
        segments: [],
        dataScope: { 
          segments: new Set(),
          fileIds: new Set()
        }
      };
      
      if (cachedFiles.length > 0 && cachedFiles[0].data.sample) {
        for (const file of cachedFiles) {
          payload.filteredData.push(...Object.values(file.data));
          if (file.loadedSegments.size > 0) {
            payload.segments = [...payload.segments, ...Array.from(file.loadedSegments)];
          }
          payload.dataScope.fileIds.add(file.id);
        }
        
        results.dataProcessing = {
          working: true,
          details: {
            assistantPayload: {
              filteredDataLength: payload.filteredData.length,
              segments: payload.segments,
              fileIds: Array.from(payload.dataScope.fileIds)
            }
          }
        };
        results.steps.push('Data processing: SUCCESS');
      } else {
        results.dataProcessing = {
          working: false,
          details: {
            cachedFiles: cachedFiles.length,
            hasSampleData: cachedFiles.length > 0 && !!cachedFiles[0].data.sample,
            error: 'No valid data available to send to assistant'
          }
        };
        results.steps.push('Data processing: FAILED - No valid data to process');
      }
    } catch (error) {
      results.dataProcessing = {
        working: false,
        details: {
          error: error.message
        }
      };
      results.steps.push(`Data processing: FAILED - ${error.message}`);
    }

    // OVERALL DIAGNOSIS
    results.overall.working = 
      results.fileSystem.working && 
      results.kvStorage.working && 
      results.kvRetrieval.working && 
      results.dataProcessing.working;
    
    if (results.overall.working) {
      results.overall.diagnosis = 'All systems working correctly';
      results.overall.fix = 'No fix needed';
    } else {
      // Determine where the breakdown is occurring
      if (!results.fileSystem.working) {
        results.overall.diagnosis = 'File system access is not working';
        results.overall.fix = 'Check file paths and permissions. Verify the data files exist in scripts/output/split_data';
      } else if (!results.kvStorage.working) {
        results.overall.diagnosis = 'KV storage is not working';
        results.overall.fix = 'Check KV environment variables and connection settings';
      } else if (!results.kvRetrieval.working) {
        results.overall.diagnosis = 'KV retrieval is not working';
        results.overall.fix = 'KV client may be storing data but not retrieving correctly. Check key format consistency';
      } else if (!results.dataProcessing.working) {
        results.overall.diagnosis = 'Data processing for assistant is not working';
        results.overall.fix = 'Files may be cached but data is not structured correctly for the assistant';
      }
    }

    // Clean up test data
    await kvClient.expire(`diagnostic:${testThreadId}`, 60); // Expire in 60 seconds
    
    return NextResponse.json(results);
  } catch (error) {
    logger.error('Diagnostic test error:', error);
    return NextResponse.json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 