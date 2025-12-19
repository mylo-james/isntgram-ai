import type { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";

// Define proper types for our mock data
export interface MockUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MockPost {
  id: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  likes?: number;
  comments?: number;
}

// Custom render function (no additional providers yet)
const customRender = (ui: ReactElement, renderOptions?: Omit<RenderOptions, "wrapper">) => {
  return render(ui, { ...renderOptions });
};

// Mock data factories with proper typing
export const mockUser: MockUser = {
  id: "1",
  username: "testuser",
  email: "test@example.com",
  displayName: "Test User",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockPost: MockPost = {
  id: "1",
  content: "Test post content",
  authorId: "1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  likes: 0,
  comments: 0,
};

// Additional mock data factories
export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  ...mockUser,
  ...overrides,
});

export const createMockPost = (overrides: Partial<MockPost> = {}): MockPost => ({
  ...mockPost,
  ...overrides,
});

// Custom Jest matchers can be added here
export * from "@testing-library/react";
export { customRender as render };
