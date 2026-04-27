import { CacheManager } from '../cache-manager.js';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  describe('get and set', () => {
    it('should store and retrieve values', () => {
      const key = 'test-key';
      const value = { data: 'test' };
      
      cacheManager.set(key, value);
      const retrieved = cacheManager.get(key);
      
      expect(retrieved).toEqual(value);
    });

    it('should return undefined for non-existent keys', () => {
      const result = cacheManager.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should respect TTL', () => {
      const key = 'test-key';
      const value = { data: 'test' };
      const ttl = 100; // 100ms
      
      cacheManager.set(key, value, ttl);
      
      // Value should be available immediately
      expect(cacheManager.get(key)).toEqual(value);
      
      // Manually expire the entry by setting timestamp in the past
      const entry = (cacheManager as any).cache.get(key);
      if (entry) {
        entry.timestamp = Date.now() - 150;
      }
      
      expect(cacheManager.get(key)).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', () => {
      cacheManager.set('key1', { data: 'test1' });
      cacheManager.set('key2', { data: 'test2' });
      
      cacheManager.clear();
      
      expect(cacheManager.get('key1')).toBeUndefined();
      expect(cacheManager.get('key2')).toBeUndefined();
    });

    it('should reset statistics on clear', () => {
      cacheManager.set('key1', { data: 'test1' });
      cacheManager.get('key1'); // Hit
      
      const statsBefore = cacheManager.getStats();
      expect(statsBefore.hits).toBe(1);
      
      cacheManager.clear();
      
      const statsAfter = cacheManager.getStats();
      expect(statsAfter.hits).toBe(0);
      expect(statsAfter.misses).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should track cache hits', () => {
      cacheManager.set('key1', { data: 'test1' });
      cacheManager.get('key1');
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('should track cache misses', () => {
      cacheManager.get('non-existent');
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate correctly', () => {
      cacheManager.set('key1', { data: 'test1' });
      cacheManager.get('key1'); // Hit
      cacheManager.get('key1'); // Hit
      cacheManager.get('non-existent'); // Miss
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 2);
    });

    it('should return 0 hit rate when no requests', () => {
      const stats = cacheManager.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('prune', () => {
    it('should remove expired entries', () => {
      cacheManager.set('key1', { data: 'test1' }, 100);
      cacheManager.set('key2', { data: 'test2' }, 200);
      
      // Manually expire key1 by setting timestamp in the past
      const entry = (cacheManager as any).cache.get('key1');
      if (entry) {
        entry.timestamp = Date.now() - 150;
      }
      
      cacheManager.prune();
      
      expect((cacheManager as any).cache.has('key1')).toBe(false);
      expect((cacheManager as any).cache.has('key2')).toBe(true);
    });
  });
});
