/**
 * Shared test utilities and types for all packages
 */

export interface MockUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockPost {
  id: string;
  content: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestConfig {
  timeout: number;
  retries: number;
  verbose: boolean;
}

/**
 * Factory functions for creating mock data
 */
export class MockDataFactory {
  static createUser(overrides: Partial<MockUser> = {}): MockUser {
    return {
      id: "1",
      username: "testuser",
      email: "test@example.com",
      displayName: "Test User",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
      ...overrides,
    };
  }

  static createPost(overrides: Partial<MockPost> = {}): MockPost {
    return {
      id: "1",
      content: "Test post content",
      authorId: "1",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
      ...overrides,
    };
  }

  static createUsers(count: number, overrides: Partial<MockUser> = {}): MockUser[] {
    return Array.from({ length: count }, (_, index) =>
      this.createUser({
        id: (index + 1).toString(),
        username: `testuser${index + 1}`,
        email: `test${index + 1}@example.com`,
        displayName: `Test User ${index + 1}`,
        ...overrides,
      }),
    );
  }

  static createPosts(count: number, authorId: string = "1", overrides: Partial<MockPost> = {}): MockPost[] {
    return Array.from({ length: count }, (_, index) =>
      this.createPost({
        id: (index + 1).toString(),
        content: `Test post content ${index + 1}`,
        authorId,
        ...overrides,
      }),
    );
  }
}

/**
 * Common test utilities
 */
export class TestUtils {
  /**
   * Sleep for a given number of milliseconds
   */
  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate a random string for testing
   */
  static randomString(length: number = 10): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate a random email for testing
   */
  static randomEmail(): string {
    return `${this.randomString(8).toLowerCase()}@test.com`;
  }

  /**
   * Generate a random username for testing
   */
  static randomUsername(): string {
    return `user_${this.randomString(6).toLowerCase()}`;
  }

  /**
   * Create a date in the past for testing
   */
  static pastDate(daysAgo: number = 7): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }

  /**
   * Create a date in the future for testing
   */
  static futureDate(daysFromNow: number = 7): Date {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  }

  /**
   * Validate that an object matches expected shape
   */
  static validateShape<T>(obj: unknown, expectedKeys: (keyof T)[]): obj is T {
    if (!obj || typeof obj !== "object") return false;

    return expectedKeys.every((key) => key in obj);
  }

  /**
   * Deep clone an object for testing
   */
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

/**
 * Test configuration defaults
 */
export const DEFAULT_TEST_CONFIG: TestConfig = {
  timeout: 5000,
  retries: 2,
  verbose: false,
};

/**
 * Common test assertions
 */
export class TestAssertions {
  /**
   * Assert that a value is a valid UUID
   */
  static isValidUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  /**
   * Assert that a value is a valid email
   */
  static isValidEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  /**
   * Assert that a date is within a range
   */
  static isDateWithinRange(date: Date, start: Date, end: Date): boolean {
    return date >= start && date <= end;
  }

  /**
   * Assert that an object has required properties
   */
  static hasRequiredProperties<T>(obj: unknown, properties: (keyof T)[]): boolean {
    if (!obj || typeof obj !== "object") return false;
    return properties.every((prop) => Object.prototype.hasOwnProperty.call(obj, prop));
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTestUtils {
  /**
   * Measure execution time of a function
   */
  static async measureExecutionTime<T>(fn: () => Promise<T> | T): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const duration = end - start;

    return { result, duration };
  }

  /**
   * Assert that a function executes within a time limit
   */
  static async assertExecutionTime<T>(fn: () => Promise<T> | T, maxDurationMs: number): Promise<T> {
    const { result, duration } = await this.measureExecutionTime(fn);

    if (duration > maxDurationMs) {
      throw new Error(`Function took ${duration}ms, expected less than ${maxDurationMs}ms`);
    }

    return result;
  }
}
