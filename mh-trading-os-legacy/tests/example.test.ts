import { describe, it, expect } from '@jest/globals';

describe('Example Backend Test', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should check environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.API_SECRET_KEY).toBe('test-api-key');
  });
});
