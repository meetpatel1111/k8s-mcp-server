/**
 * Safe execution tests
 */

import { safeExecute, ErrorContext } from '../error-handling.js';

describe('Safe Execution', () => {
  describe('safeExecute', () => {
    it('should execute successful operation', async () => {
      const operation = async () => {
        return { success: true, data: 'test' };
      };
      const context: ErrorContext = { operation: 'test' };
      
      const result = await safeExecute(operation, context);
      
      expect(result).toEqual({ success: true, data: 'test' });
    });

    it('should handle operation errors', async () => {
      const operation = async () => {
        throw new Error('Test error');
      };
      const context: ErrorContext = { operation: 'test' };
      
      await expect(safeExecute(operation, context)).rejects.toThrow();
    });

    it('should retry on transient errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Transient error');
        }
        return { success: true };
      };
      const context: ErrorContext = { operation: 'test' };
      
      const result = await safeExecute(operation, context, { retry: true, maxRetries: 3 });
      
      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });

    it('should not retry validation errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('validation failed');
      };
      const context: ErrorContext = { operation: 'test' };
      
      await expect(safeExecute(operation, context, { retry: true, maxRetries: 3 })).rejects.toThrow();
      expect(attempts).toBe(1);
    });

    it('should not retry permission errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        const error = new Error('Forbidden') as any;
        error.statusCode = 403;
        throw error;
      };
      const context: ErrorContext = { operation: 'test' };
      
      await expect(safeExecute(operation, context, { retry: true, maxRetries: 3 })).rejects.toThrow();
      expect(attempts).toBe(1);
    });

    it('should respect retry: false option', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('Transient error');
      };
      const context: ErrorContext = { operation: 'test' };
      
      await expect(safeExecute(operation, context, { retry: false })).rejects.toThrow();
      expect(attempts).toBe(1);
    });

    it('should use default timeout when not specified', async () => {
      const operation = async () => {
        return { success: true };
      };
      const context: ErrorContext = { operation: 'test' };
      
      const result = await safeExecute(operation, context);
      
      expect(result).toEqual({ success: true });
    });
  });
});
