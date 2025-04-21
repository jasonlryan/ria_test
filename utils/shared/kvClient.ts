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

interface KVClient {
  get(key: string): Promise<any | null>;
  set(key: string, value: any): Promise<boolean>;
  hset(key: string, obj: Record<string, string>): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  expire(key: string, seconds: number): Promise<number>;
}

let kvClient: KVClient;

// Check if KV is explicitly disabled
const useKv = process.env.USE_KV !== 'false';

// Use in-memory store if KV is disabled or credentials are missing
if (!useKv || ((!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) && !process.env.REDIS_URL)) {
  console.warn(`KV ${!useKv ? 'disabled by USE_KV=false' : 'env vars missing'}, using in-memory fallback for KV client.`);

  const inMemoryStore = new Map<string, any>();

  kvClient = {
    async get(key: string) {
      console.log(`🧠 KV CACHE [MEMORY] GET: ${key}`);
      return inMemoryStore.get(key) ?? null;
    },
    async set(key: string, value: any) {
      console.log(`🧠 KV CACHE [MEMORY] SET: ${key}`);
      inMemoryStore.set(key, value);
      return true;
    },
    async hset(key: string, obj: Record<string, string>) {
      console.log(`🧠 KV CACHE [MEMORY] HSET: ${key} with ${Object.keys(obj).length} fields`);
      const existing = inMemoryStore.get(key) || {};
      const merged = { ...existing, ...obj };
      inMemoryStore.set(key, merged);
      return 1;
    },
    async hgetall(key: string) {
      console.log(`🧠 KV CACHE [MEMORY] HGETALL: ${key}`);
      return inMemoryStore.get(key) || {};
    },
    async expire(key: string, seconds: number) {
      console.log(`🧠 KV CACHE [MEMORY] EXPIRE: ${key} in ${seconds}s`);
      setTimeout(() => inMemoryStore.delete(key), seconds * 1000);
      return 1;
    },
  };
} else {
  console.log("✅ REDIS CONNECTION ACTIVE: Using " + (process.env.REDIS_URL ? "REDIS_URL" : "KV_REST_API vars") + " (USE_KV=true)");
  
  // Wrap Vercel KV to adapt return types
  kvClient = {
    async get(key: string) {
      console.log(`🔴 KV CACHE [REDIS] GET: ${key}`);
      const start = Date.now();
      const result = await kv.get(key);
      const duration = Date.now() - start;
      console.log(`🔴 KV CACHE [REDIS] GET ${key}: ${result ? 'HIT' : 'MISS'} (${duration}ms)`);
      return result;
    },
    async set(key: string, value: any) {
      console.log(`🔴 KV CACHE [REDIS] SET: ${key}`);
      const start = Date.now();
      const result = await kv.set(key, value);
      const duration = Date.now() - start;
      console.log(`🔴 KV CACHE [REDIS] SET ${key}: DONE (${duration}ms)`);
      return result;
    },
    async hset(key: string, obj: Record<string, string>) {
      console.log(`🔴 KV CACHE [REDIS] HSET: ${key} with ${Object.keys(obj).length} fields`);
      const result = await kv.hset(key, obj);
      return result ? 1 : 0;
    },
    async hgetall(key: string): Promise<Record<string, string>> {
      console.log(`🔴 KV CACHE [REDIS] HGETALL: ${key}`);
      const start = Date.now();
      const result = await kv.hgetall(key) as Record<string, string>;
      const duration = Date.now() - start;
      console.log(`🔴 KV CACHE [REDIS] HGETALL ${key}: ${result ? 'HIT' : 'MISS'} (${duration}ms)`);
      return result || {};
    },
    async expire(key: string, seconds: number) {
      console.log(`🔴 KV CACHE [REDIS] EXPIRE: ${key} in ${seconds}s`);
      return await kv.expire(key, seconds);
    },
  };
}

export default kvClient;
