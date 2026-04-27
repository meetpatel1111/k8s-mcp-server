/**
 * Cache Manager for K8s MCP Server
 * Handles response caching for read-only operations
 */

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export interface CacheStatistics {
  size: number;
  keys: string[];
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
  totalRequests: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly defaultTtl: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(defaultTtl: number = 5000) {
    this.defaultTtl = defaultTtl;
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get(key: string): any | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.data;
  }

  /**
   * Set cached data with optional TTL
   */
  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
    });
  }

  /**
   * Remove expired entries from cache
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get detailed cache statistics
   */
  getStats(): CacheStatistics {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (this.misses / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round(missRate * 100) / 100,
      totalRequests,
    };
  }

  /**
   * Reset statistics counters (without clearing cache)
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if a key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }
}
