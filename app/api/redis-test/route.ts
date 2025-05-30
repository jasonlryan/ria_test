import { NextResponse } from 'next/server';
import kvClient from '../../../utils/cache/kvClient';

export async function GET() {
  const testKey = 'test-redis-' + Date.now();
  const testValue = { timestamp: Date.now(), test: 'Redis connection test' };
  
  try {
    // Write to Redis
    await kvClient.set(testKey, testValue);
    console.log('Wrote test key to Redis:', testKey);
    
    // Read from Redis
    const retrieved = await kvClient.get(testKey);
    console.log('Retrieved from Redis:', retrieved);
    
    const success = JSON.stringify(retrieved) === JSON.stringify(testValue);
    
    return NextResponse.json({ 
      working: success,
      testKey,
      original: testValue,
      retrieved
    });
  } catch (error) {
    console.error('Redis test failed:', error);
    return NextResponse.json({ 
      working: false, 
      error: error.message 
    }, { status: 500 });
  }
} 