/**
 * Vercel KV Client Singleton with Local Fallback and Type Adaptation
 * 
 * Provides a singleton instance of the Vercel KV client.
 * Wraps VercelKV methods to adapt return types for compatibility.
 * Falls back to an in-memory store if KV environment variables are missing,
 * enabling local development without KV access.
 * 
 * USE_KV environment variable can override behavior:
 * - If USE_KV=false: Always use in-memory store regardless of KV credentials
 * - If USE_KV=true or not set: Use KV if credentials available
 */

import { kv } from "@vercel/kv";
import logger from "../shared/logger";
import { performance } from "perf_hooks";

// Define options interface based on Redis options
export interface KVOptions {
  ex?: number; // Expiration in seconds
  px?: number; // Expiration in milliseconds
  nx?: boolean; // Only set if key doesn't exist
  xx?: boolean; // Only set if key exists
  keepTtl?: boolean; // Keep existing TTL
}

// Map our KVOptions to Vercel's expected structure to avoid type assertions
function mapOptionsToVercelKV(options?: KVOptions): any {
  if (!options) return undefined;
  
  // Create a new object with only the properties Vercel KV expects
  const vercelOptions: any = {};
  
  if (options.ex !== undefined) vercelOptions.ex = options.ex;
  if (options.px !== undefined) vercelOptions.px = options.px;
  if (options.nx !== undefined) vercelOptions.nx = options.nx;
  if (options.xx !== undefined) vercelOptions.xx = options.xx;
  if (options.keepTtl !== undefined) vercelOptions.keepTtl = options.keepTtl;
  
  return vercelOptions;
}

export interface KVClient {
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T, options?: KVOptions): Promise<boolean>;
  del(key: string): Promise<number>;
  hget<T = any>(key: string, field: string): Promise<T | null>;
  hset(key: string, obj: Record<string, any>): Promise<number>;
  hgetall<T = any>(key: string): Promise<Record<string, T>>;
  hkeys(key: string): Promise<string[]>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  ping(): Promise<boolean>;
}

// Check if running in a Vercel environment
const isVercelEnvironment = !!process.env.VERCEL || !!process.env.VERCEL_ENV;

// Check if KV is explicitly disabled
const useKv = process.env.USE_KV !== 'false';

// Check if KV is configured
const isKvConfigured = !!(
  (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) || 
  process.env.REDIS_URL
);

// Determine if we should use KV
const shouldUseKv = useKv && (isVercelEnvironment || isKvConfigured);

/**
 * Create an in-memory store for local development fallback
 */
class InMemoryStore implements KVClient {
  private store = new Map<string, any>();
  private hashStore = new Map<string, Map<string, any>>();
  private expirations = new Map<string, number>();
  
  // Memory protection settings
  private readonly MAX_CACHE_SIZE = 1000; // Maximum number of cache entries
  private readonly LRU_TRACKING = new Map<string, number>(); // Track last access time

  constructor() {
    // Clean up expired keys periodically
    setInterval(() => this.cleanupExpiredKeys(), 60000);
  }

  /**
   * Track LRU access for a key
   * @param key Key being accessed
   */
  private trackAccess(key: string): void {
    this.LRU_TRACKING.set(key, Date.now());
    
    // If we're over the limit, remove least recently used items
    if (this.store.size + this.hashStore.size > this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }
  }
  
  /**
   * Evict least recently used items to maintain memory limits
   */
  private evictLRU(): void {
    logger.debug(`Cache size limit reached (${this.store.size + this.hashStore.size} items), evicting LRU entries`);
    
    // Combine all keys from store and hashStore
    const allKeys = [
      ...Array.from(this.store.keys()), 
      ...Array.from(this.hashStore.keys())
    ];
    
    // Sort by access time (oldest first)
    const lruSorted = allKeys
      .map(key => ({ key, lastAccess: this.LRU_TRACKING.get(key) || 0 }))
      .sort((a, b) => a.lastAccess - b.lastAccess);
    
    // Evict 20% of the cache or until we're under the limit
    const evictionCount = Math.ceil(this.MAX_CACHE_SIZE * 0.2);
    for (let i = 0; i < evictionCount && i < lruSorted.length; i++) {
      const { key } = lruSorted[i];
      this.store.delete(key);
      this.hashStore.delete(key);
      this.expirations.delete(key);
      this.LRU_TRACKING.delete(key);
      
      logger.debug(`Cache LRU eviction: ${key}`);
    }
  }

  /**
   * Check if a key has expired
   * @param key Key to check
   * @returns Whether the key has expired
   */
  private hasExpired(key: string): boolean {
    const expiration = this.expirations.get(key);
    return !!expiration && expiration < Date.now();
  }

  /**
   * Remove expired keys
   */
  private cleanupExpiredKeys(): void {
    const now = Date.now();
    for (const [key, expiration] of this.expirations.entries()) {
      if (expiration < now) {
        this.store.delete(key);
        this.hashStore.delete(key);
        this.expirations.delete(key);
        this.LRU_TRACKING.delete(key);
      }
    }
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or null
   */
  async get<T = any>(key: string): Promise<T | null> {
    const start = performance.now();
    
    if (this.hasExpired(key)) {
      this.store.delete(key);
      this.expirations.delete(key);
      logger.debug(`🧠 KV CACHE [MEMORY] GET: ${key} (EXPIRED)`);
      return null;
    }
    
    const value = this.store.get(key) as T;
    if (value) {
      this.trackAccess(key);
    }
    
    const duration = performance.now() - start;
    logger.debug(`🧠 KV CACHE [MEMORY] GET: ${key} (${value ? 'HIT' : 'MISS'}) ${duration.toFixed(2)}ms`);
    return value || null;
  }

  /**
   * Set value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param options Cache options
   * @returns Success status
   */
  async set<T = any>(key: string, value: T, options?: KVOptions): Promise<boolean> {
    const start = performance.now();
    
    // Handle nx (Only set if key doesn't exist)
    if (options?.nx && this.store.has(key) && !this.hasExpired(key)) {
      logger.debug(`🧠 KV CACHE [MEMORY] SET: ${key} (NX CONDITION FAILED)`);
      return false;
    }
    
    // Handle xx (Only set if key exists)
    if (options?.xx && (!this.store.has(key) || this.hasExpired(key))) {
      logger.debug(`🧠 KV CACHE [MEMORY] SET: ${key} (XX CONDITION FAILED)`);
      return false;
    }
    
    this.store.set(key, value);
    this.trackAccess(key);
    
    // Handle expiration
    if (options?.ex) {
      this.expirations.set(key, Date.now() + (options.ex * 1000));
    } else if (options?.px) {
      this.expirations.set(key, Date.now() + options.px);
    }
    
    const duration = performance.now() - start;
    logger.debug(`🧠 KV CACHE [MEMORY] SET: ${key} ${duration.toFixed(2)}ms`);
    return true;
  }

  /**
   * Delete a key
   * @param key Key to delete
   * @returns 1 if deleted, 0 if not found
   */
  async del(key: string): Promise<number> {
    const start = performance.now();
    const existed = this.store.has(key) && !this.hasExpired(key);
    this.store.delete(key);
    this.hashStore.delete(key);
    this.expirations.delete(key);
    this.LRU_TRACKING.delete(key);
    
    const duration = performance.now() - start;
    logger.debug(`🧠 KV CACHE [MEMORY] DEL: ${key} ${duration.toFixed(2)}ms`);
    return existed ? 1 : 0;
  }

  /**
   * Get a hash field
   * @param key Hash key
   * @param field Field name
   * @returns Field value or null
   */
  async hget<T = any>(key: string, field: string): Promise<T | null> {
    const start = performance.now();
    
    if (this.hasExpired(key)) {
      this.hashStore.delete(key);
      this.expirations.delete(key);
      logger.debug(`🧠 KV CACHE [MEMORY] HGET: ${key}.${field} (EXPIRED)`);
      return null;
    }
    
    const hash = this.hashStore.get(key);
    const value = hash?.get(field) as T;
    
    if (hash && hash.has(field)) {
      this.trackAccess(key);
    }
    
    const duration = performance.now() - start;
    logger.debug(`🧠 KV CACHE [MEMORY] HGET: ${key}.${field} (${value ? 'HIT' : 'MISS'}) ${duration.toFixed(2)}ms`);
    return value || null;
  }

  /**
   * Set hash fields
   * @param key Hash key
   * @param obj Fields to set
   * @returns Number of fields set
   */
  async hset(key: string, obj: Record<string, any>): Promise<number> {
    const start = performance.now();
    
    if (this.hasExpired(key)) {
      this.hashStore.delete(key);
      this.expirations.delete(key);
    }
    
    if (!this.hashStore.has(key)) {
      this.hashStore.set(key, new Map());
    }
    
    const hash = this.hashStore.get(key)!;
    let count = 0;
    
    for (const [field, value] of Object.entries(obj)) {
      hash.set(field, value);
      count++;
    }
    
    this.trackAccess(key);
    
    const duration = performance.now() - start;
    logger.debug(`🧠 KV CACHE [MEMORY] HSET: ${key} with ${count} fields ${duration.toFixed(2)}ms`);
    return count;
  }

  /**
   * Get all hash fields
   * @param key Hash key
   * @returns Hash fields or empty object
   */
  async hgetall<T = any>(key: string): Promise<Record<string, T>> {
    const start = performance.now();
    
    if (this.hasExpired(key)) {
      this.hashStore.delete(key);
      this.expirations.delete(key);
      logger.debug(`🧠 KV CACHE [MEMORY] HGETALL: ${key} (EXPIRED)`);
      return {};
    }
    
    const hash = this.hashStore.get(key);
    if (!hash) {
      logger.debug(`🧠 KV CACHE [MEMORY] HGETALL: ${key} (MISS)`);
      return {};
    }
    
    this.trackAccess(key);
    
    const result: Record<string, T> = {};
    for (const [field, value] of hash.entries()) {
      result[field] = value as T;
    }
    
    const duration = performance.now() - start;
    logger.debug(`🧠 KV CACHE [MEMORY] HGETALL: ${key} (HIT) ${duration.toFixed(2)}ms`);
    return result;
  }

  /**
   * Get all hash keys
   * @param key Hash key
   * @returns Array of field names
   */
  async hkeys(key: string): Promise<string[]> {
    const start = performance.now();
    
    if (this.hasExpired(key)) {
      this.hashStore.delete(key);
      this.expirations.delete(key);
      logger.debug(`🧠 KV CACHE [MEMORY] HKEYS: ${key} (EXPIRED)`);
      return [];
    }
    
    const hash = this.hashStore.get(key);
    if (!hash) {
      logger.debug(`🧠 KV CACHE [MEMORY] HKEYS: ${key} (MISS)`);
      return [];
    }
    
    this.trackAccess(key);
    
    const result = Array.from(hash.keys());
    
    const duration = performance.now() - start;
    logger.debug(`🧠 KV CACHE [MEMORY] HKEYS: ${key} (${result.length} keys) ${duration.toFixed(2)}ms`);
    return result;
  }

  /**
   * Increment hash field
   * @param key Hash key
   * @param field Field to increment
   * @param increment Value to add
   * @returns New value
   */
  async hincrby(key: string, field: string, increment: number): Promise<number> {
    const start = performance.now();
    
    if (this.hasExpired(key)) {
      this.hashStore.delete(key);
      this.expirations.delete(key);
    }
    
    if (!this.hashStore.has(key)) {
      this.hashStore.set(key, new Map());
    }
    
    const hash = this.hashStore.get(key)!;
    const currentValue = (hash.get(field) as number) || 0;
    const newValue = currentValue + increment;
    hash.set(field, newValue);
    
    this.trackAccess(key);
    
    const duration = performance.now() - start;
    logger.debug(`🧠 KV CACHE [MEMORY] HINCRBY: ${key}.${field} +${increment} = ${newValue} ${duration.toFixed(2)}ms`);
    return newValue;
  }

  /**
   * Set expiration on key
   * @param key Key to set expiration on
   * @param seconds Seconds until expiration
   * @returns 1 if expiration set, 0 if key not found
   */
  async expire(key: string, seconds: number): Promise<number> {
    const start = performance.now();
    
    if (!this.store.has(key) && !this.hashStore.has(key)) {
      logger.debug(`🧠 KV CACHE [MEMORY] EXPIRE: ${key} (KEY NOT FOUND)`);
      return 0;
    }
    
    this.expirations.set(key, Date.now() + (seconds * 1000));
    
    const duration = performance.now() - start;
    logger.debug(`🧠 KV CACHE [MEMORY] EXPIRE: ${key} in ${seconds}s ${duration.toFixed(2)}ms`);
    return 1;
  }

  /**
   * Get time to live for a key
   * @param key Key to check
   * @returns TTL in seconds or -2 if expired/not found, -1 if no expiration
   */
  async ttl(key: string): Promise<number> {
    const start = performance.now();
    
    if (!this.store.has(key) && !this.hashStore.has(key)) {
      logger.debug(`🧠 KV CACHE [MEMORY] TTL: ${key} (KEY NOT FOUND)`);
      return -2;
    }
    
    const expiration = this.expirations.get(key);
    if (!expiration) {
      logger.debug(`🧠 KV CACHE [MEMORY] TTL: ${key} (NO EXPIRATION)`);
      return -1;
    }
    
    const ttl = Math.ceil((expiration - Date.now()) / 1000);
    if (ttl <= 0) {
      this.store.delete(key);
      this.hashStore.delete(key);
      this.expirations.delete(key);
      this.LRU_TRACKING.delete(key);
      logger.debug(`🧠 KV CACHE [MEMORY] TTL: ${key} (EXPIRED)`);
      return -2;
    }
    
    const duration = performance.now() - start;
    logger.debug(`🧠 KV CACHE [MEMORY] TTL: ${key} = ${ttl}s ${duration.toFixed(2)}ms`);
    return ttl;
  }

  /**
   * Check if key exists
   * @param key Key to check
   * @returns 1 if exists, 0 if not
   */
  async exists(key: string): Promise<number> {
    const start = performance.now();
    
    if (this.hasExpired(key)) {
      this.store.delete(key);
      this.hashStore.delete(key);
      this.expirations.delete(key);
      this.LRU_TRACKING.delete(key);
      logger.debug(`🧠 KV CACHE [MEMORY] EXISTS: ${key} (EXPIRED)`);
      return 0;
    }
    
    const exists = this.store.has(key) || this.hashStore.has(key);
    
    if (exists) {
      this.trackAccess(key);
    }
    
    const duration = performance.now() - start;
    logger.debug(`🧠 KV CACHE [MEMORY] EXISTS: ${key} = ${exists ? 1 : 0} ${duration.toFixed(2)}ms`);
    return exists ? 1 : 0;
  }

  /**
   * Check if store is available
   * @returns Always true for in-memory store
   */
  async ping(): Promise<boolean> {
    logger.debug('🧠 KV CACHE [MEMORY] PING');
    return true;
  }
}

/**
 * Create a Vercel KV client wrapper
 */
class VercelKVClient implements KVClient {
  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or null
   */
  async get<T = any>(key: string): Promise<T | null> {
    const start = performance.now();
    try {
      const result = await kv.get<T>(key);
      const duration = performance.now() - start;
      logger.debug(`🔴 KV CACHE [REDIS] GET: ${key} (${result ? 'HIT' : 'MISS'}) ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      logger.error(`KV error GET ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Set value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param options Cache options
   * @returns Success status
   */
  async set<T = any>(key: string, value: T, options?: KVOptions): Promise<boolean> {
    const start = performance.now();
    try {
      // Use the mapper function instead of type assertion
      const vercelOptions = mapOptionsToVercelKV(options);
      await kv.set(key, value, vercelOptions);
      const duration = performance.now() - start;
      logger.debug(`🔴 KV CACHE [REDIS] SET: ${key} ${duration.toFixed(2)}ms`);
      return true;
    } catch (error) {
      logger.error(`KV error SET ${key}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Delete a key
   * @param key Key to delete
   * @returns 1 if deleted, 0 if not found
   */
  async del(key: string): Promise<number> {
    const start = performance.now();
    try {
      const result = await kv.del(key);
      const duration = performance.now() - start;
      logger.debug(`🔴 KV CACHE [REDIS] DEL: ${key} ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      logger.error(`KV error DEL ${key}: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Get a hash field
   * @param key Hash key
   * @param field Field name
   * @returns Field value or null
   */
  async hget<T = any>(key: string, field: string): Promise<T | null> {
    const start = performance.now();
    try {
      const result = await kv.hget<T>(key, field);
      const duration = performance.now() - start;
      logger.debug(`🔴 KV CACHE [REDIS] HGET: ${key}.${field} (${result ? 'HIT' : 'MISS'}) ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      logger.error(`KV error HGET ${key}.${field}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Set hash fields
   * @param key Hash key
   * @param obj Fields to set
   * @returns Number of fields set
   */
  async hset(key: string, obj: Record<string, any>): Promise<number> {
    const start = performance.now();
    try {
      const result = await kv.hset(key, obj);
      const duration = performance.now() - start;
      logger.debug(`🔴 KV CACHE [REDIS] HSET: ${key} with ${Object.keys(obj).length} fields ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      logger.error(`KV error HSET ${key}: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Get all hash fields
   * @param key Hash key
   * @returns Hash fields or empty object
   */
  async hgetall<T = any>(key: string): Promise<Record<string, T>> {
    const start = performance.now();
    try {
      // Use explicit typing for the result
      const result = await kv.hgetall(key);
      const typedResult = result as Record<string, T> || {};
      
      const duration = performance.now() - start;
      const isEmpty = Object.keys(typedResult).length === 0;
      logger.debug(`🔴 KV CACHE [REDIS] HGETALL: ${key} (${isEmpty ? 'MISS' : 'HIT'}) ${duration.toFixed(2)}ms`);
      return typedResult;
    } catch (error) {
      logger.error(`KV error HGETALL ${key}: ${(error as Error).message}`);
      return {};
    }
  }

  /**
   * Get all hash keys
   * @param key Hash key
   * @returns Array of field names
   */
  async hkeys(key: string): Promise<string[]> {
    const start = performance.now();
    try {
      const result = await kv.hkeys(key);
      const duration = performance.now() - start;
      logger.debug(`🔴 KV CACHE [REDIS] HKEYS: ${key} (${result.length} keys) ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      logger.error(`KV error HKEYS ${key}: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Increment hash field
   * @param key Hash key
   * @param field Field to increment
   * @param increment Value to add
   * @returns New value
   */
  async hincrby(key: string, field: string, increment: number): Promise<number> {
    const start = performance.now();
    try {
      const result = await kv.hincrby(key, field, increment);
      const duration = performance.now() - start;
      logger.debug(`🔴 KV CACHE [REDIS] HINCRBY: ${key}.${field} +${increment} = ${result} ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      logger.error(`KV error HINCRBY ${key}.${field}: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Set expiration on key
   * @param key Key to set expiration on
   * @param seconds Seconds until expiration
   * @returns 1 if expiration set, 0 if key not found
   */
  async expire(key: string, seconds: number): Promise<number> {
    const start = performance.now();
    try {
      const result = await kv.expire(key, seconds);
      const duration = performance.now() - start;
      logger.debug(`🔴 KV CACHE [REDIS] EXPIRE: ${key} in ${seconds}s ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      logger.error(`KV error EXPIRE ${key}: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Get time to live for a key
   * @param key Key to check
   * @returns TTL in seconds or -2 if expired/not found, -1 if no expiration
   */
  async ttl(key: string): Promise<number> {
    const start = performance.now();
    try {
      const result = await kv.ttl(key);
      const duration = performance.now() - start;
      logger.debug(`🔴 KV CACHE [REDIS] TTL: ${key} = ${result}s ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      logger.error(`KV error TTL ${key}: ${(error as Error).message}`);
      return -2;
    }
  }

  /**
   * Check if key exists
   * @param key Key to check
   * @returns 1 if exists, 0 if not
   */
  async exists(key: string): Promise<number> {
    const start = performance.now();
    try {
      const result = await kv.exists(key);
      const duration = performance.now() - start;
      logger.debug(`🔴 KV CACHE [REDIS] EXISTS: ${key} = ${result} ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      logger.error(`KV error EXISTS ${key}: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Check if KV is available
   * @returns True if ping succeeds
   */
  async ping(): Promise<boolean> {
    try {
      await kv.ping();
      logger.debug('🔴 KV CACHE [REDIS] PING: Success');
      return true;
    } catch (error) {
      logger.error(`KV PING error: ${(error as Error).message}`);
      return false;
    }
  }
}

// Initialize the appropriate client
const kvClient: KVClient = shouldUseKv 
  ? new VercelKVClient() 
  : new InMemoryStore();

// Log initialization status
if (shouldUseKv) {
  logger.info(`✅ REDIS CONNECTION ACTIVE: Using ${process.env.REDIS_URL ? "REDIS_URL" : "KV_REST_API vars"}`);
} else {
  logger.info(`🧠 Using in-memory fallback for KV client (${!useKv ? 'USE_KV=false' : !isKvConfigured ? 'KV not configured' : 'Not in Vercel env'})`);
}

// Ping the client to verify connection
kvClient.ping().then(success => {
  if (success) {
    logger.info('KV client connection verified successfully');
  } else {
    logger.warn('KV client connection could not be verified');
  }
}).catch(error => {
  logger.error(`KV client connection error: ${error.message}`);
});

export default kvClient;
