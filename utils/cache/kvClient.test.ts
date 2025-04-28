/**
 * KV Client Migration Verification Test
 * 
 * This test verifies that the adapter in utils/shared/kvClient.ts
 * correctly forwards to the new location at utils/cache/kvClient.ts
 */

// Import from both old and new locations to verify compatibility
const sharedKvClient = require('../shared/kvClient').default;
const cacheKvClient = require('./kvClient').default;

// Test that both imports point to the same object
console.log('Testing KV client migration...');

// Generate a unique test key
const testKey = `migration-test-${Date.now()}`;
const testValue = { test: true, timestamp: Date.now() };

async function runTests() {
  try {
    // Test 1: Verify that both imports refer to the same object
    const areEqual = sharedKvClient === cacheKvClient;
    console.log(`Test 1: Both imports refer to the same object: ${areEqual ? 'PASS' : 'FAIL'}`);
    
    // Test 2: Verify set/get functionality through the original import
    await sharedKvClient.set(testKey, testValue);
    const valueFromShared = await sharedKvClient.get(testKey);
    const test2Pass = JSON.stringify(valueFromShared) === JSON.stringify(testValue);
    console.log(`Test 2: Set/get via shared import: ${test2Pass ? 'PASS' : 'FAIL'}`);
    
    // Test 3: Verify get functionality through the new import
    const valueFromCache = await cacheKvClient.get(testKey);
    const test3Pass = JSON.stringify(valueFromCache) === JSON.stringify(testValue);
    console.log(`Test 3: Get via cache import: ${test3Pass ? 'PASS' : 'FAIL'}`);
    
    // Test 4: Verify hash operations
    await sharedKvClient.hset(testKey + '-hash', { field1: 'value1', field2: 'value2' });
    const field1 = await cacheKvClient.hget(testKey + '-hash', 'field1');
    const test4Pass = field1 === 'value1';
    console.log(`Test 4: Hash operations cross-imports: ${test4Pass ? 'PASS' : 'FAIL'}`);
    
    // Cleanup
    await sharedKvClient.del(testKey);
    await sharedKvClient.del(testKey + '-hash');
    
    // Final result
    const allPassed = areEqual && test2Pass && test3Pass && test4Pass;
    console.log(`\nMigration verification: ${allPassed ? 'SUCCESSFUL' : 'FAILED'}`);
    
    return allPassed;
  } catch (error) {
    console.error('Migration test failed with error:', error);
    return false;
  }
}

// Run the tests
runTests().then(success => {
  if (success) {
    console.log('KV Client migration successful. The adapter is working correctly.');
  } else {
    console.error('KV Client migration verification failed. Please check the error messages above.');
  }
}); 