import { classifyError, ErrorContext } from '../error-handling.js';

describe('Error Handling', () => {
  describe('classifyError', () => {
    it('should classify authentication errors', () => {
      const error = new Error('Unauthorized: invalid credentials');
      const context: ErrorContext = { operation: 'test', resource: 'test-pod', namespace: 'default' };
      
      const result = classifyError(error, context);
      
      expect(result.type).toBe('permission');
      expect(result.suggestions).toBeDefined();
    });

    it('should classify authorization errors', () => {
      const error = new Error('Forbidden: user does not have access');
      const context: ErrorContext = { operation: 'test', resource: 'test-pod', namespace: 'default' };
      
      const result = classifyError(error, context);
      
      expect(result.type).toBe('permission');
      expect(result.suggestions).toBeDefined();
    });

    it('should classify network errors', () => {
      const error = new Error('ECONNREFUSED: connection refused');
      const context: ErrorContext = { operation: 'test', resource: 'test-pod', namespace: 'default' };
      
      const result = classifyError(error, context);
      
      expect(result.type).toBe('network');
      expect(result.suggestions).toBeDefined();
    });

    it('should classify not found errors', () => {
      const error = new Error('NotFound: pod not found');
      const context: ErrorContext = { operation: 'test', resource: 'test-pod', namespace: 'default' };
      
      const result = classifyError(error, context);
      
      expect(result.type).toBe('not_found');
      expect(result.suggestions).toBeDefined();
    });

    it('should classify timeout errors', () => {
      const error = new Error('ETIMEDOUT: request timed out');
      const context: ErrorContext = { operation: 'test', resource: 'test-pod', namespace: 'default' };
      
      const result = classifyError(error, context);
      
      expect(result.type).toBe('timeout');
      expect(result.suggestions).toBeDefined();
    });

    it('should classify unknown errors as generic', () => {
      const error = new Error('Some unknown error');
      const context: ErrorContext = { operation: 'test', resource: 'test-pod', namespace: 'default' };
      
      const result = classifyError(error, context);
      
      expect(result.type).toBe('unknown');
      expect(result.suggestions).toBeDefined();
    });

    it('should provide suggestions for authentication errors', () => {
      const error = new Error('Unauthorized: invalid credentials');
      const context: ErrorContext = { operation: 'test', resource: 'test-pod', namespace: 'default' };
      
      const result = classifyError(error, context);
      
      expect(result.suggestions).toContain('Verify your kubeconfig has correct credentials');
      expect(result.suggestions).toContain('Check RBAC permissions for this operation');
    });

    it('should include context in error message', () => {
      const error = new Error('Test error');
      const context: ErrorContext = { 
        operation: 'list_pods', 
        resource: 'test-pod', 
        namespace: 'production' 
      };
      
      const result = classifyError(error, context);
      
      expect(result.message).toContain('list_pods');
    });
  });
});
