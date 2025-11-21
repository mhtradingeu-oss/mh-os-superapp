// Jest setup for backend tests
import { beforeAll, afterAll, afterEach } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.API_SECRET_KEY = 'test-api-key';
process.env.SHEETS_SPREADSHEET_ID = 'test-sheet-id';

// Global test timeout
jest.setTimeout(10000);

beforeAll(() => {
  console.log('🧪 Starting Backend Test Suite');
});

afterAll(() => {
  console.log('✅ Backend Test Suite Completed');
});

afterEach(() => {
  jest.clearAllMocks();
});
