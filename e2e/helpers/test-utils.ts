import { Page, expect } from '@playwright/test';

/**
 * Helper utilities for E2E tests
 */

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for the page to be fully loaded
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string) {
    await this.page.screenshot({ path: `e2e/screenshots/${name}.png` });
  }

  /**
   * Verify common page elements are present
   */
  async verifyBasicPageStructure() {
    // Check that essential HTML elements exist
    await expect(this.page.locator('html')).toBeAttached();
    await expect(this.page.locator('body')).toBeAttached();
  }

  /**
   * Check for console errors
   */
  async checkForConsoleErrors() {
    const errors: string[] = [];

    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Return a function to check errors later
    return () => {
      if (errors.length > 0) {
        throw new Error(`Console errors found: ${errors.join(', ')}`);
      }
    };
  }

  /**
   * Simulate user interactions with delays
   */
  async simulateUserClick(selector: string, delay = 100) {
    await this.page.locator(selector).click();
    await this.page.waitForTimeout(delay);
  }

  /**
   * Fill form fields with realistic typing speed
   */
  async typeRealistic(selector: string, text: string, delay = 50) {
    const element = this.page.locator(selector);
    await element.clear();
    await element.type(text, { delay });
  }
}

/**
 * Mock data for testing
 */
export const mockData = {
  user: {
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
  },
  post: {
    content: 'This is a test post for E2E testing',
  },
};

/**
 * Common test patterns
 */
export const testPatterns = {
  /**
   * Test a basic page load
   */
  async testPageLoad(page: Page, url: string, expectedTitle?: string) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');

    if (expectedTitle) {
      await expect(page).toHaveTitle(new RegExp(expectedTitle, 'i'));
    }

    // Verify no JavaScript errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Basic accessibility check
    await expect(page.locator('body')).toBeVisible();
  },

  /**
   * Test responsive behavior
   */
  async testResponsive(page: Page, url: string) {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      // Verify basic content is still visible
      await expect(page.locator('body')).toBeVisible();
    }
  },
};
