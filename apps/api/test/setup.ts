import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

// Global test setup utilities
export class TestApp {
  static app: INestApplication;

  static async createTestApp(moduleClass: any): Promise<INestApplication> {
    const moduleFixture = await Test.createTestingModule({
      imports: [moduleClass],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();

    TestApp.app = app;
    return app;
  }

  static async closeTestApp(): Promise<void> {
    if (TestApp.app) {
      await TestApp.app.close();
    }
  }
}

// Mock database configuration for testing
export const mockDatabaseConfig = {
  type: 'sqlite' as const,
  database: ':memory:',
  entities: [],
  synchronize: true,
  logging: false,
};

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  displayName: 'Test User',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockPost = (overrides = {}) => ({
  id: '1',
  content: 'Test post content',
  authorId: '1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Custom Jest matchers for API testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidResponse(): R;
      toHaveStatusCode(code: number): R;
    }
  }
}

// Extend Jest matchers
expect.extend({
  toBeValidResponse(received) {
    const pass =
      received &&
      typeof received.status === 'number' &&
      received.body !== undefined;
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid response`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be a valid response with status and body`,
        pass: false,
      };
    }
  },
  toHaveStatusCode(received, expectedStatus: number) {
    const pass = received && received.status === expectedStatus;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to have status code ${expectedStatus}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to have status code ${expectedStatus}, but got ${received?.status}`,
        pass: false,
      };
    }
  },
});
