import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

// Create a mock store for testing
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      // Add your reducers here when they're created
    },
    preloadedState: initialState,
  });
};

// Custom render function that includes providers
const customRender = (
  ui: ReactElement,
  {
    initialState = {},
    store = createMockStore(initialState),
    ...renderOptions
  }: {
    initialState?: Record<string, unknown>;
    store?: ReturnType<typeof createMockStore>;
  } & Omit<RenderOptions, "wrapper"> = {},
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return <Provider store={store}>{children}</Provider>;
  };

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
};

// Mock data factories
export const mockUser = {
  id: "1",
  username: "testuser",
  email: "test@example.com",
  displayName: "Test User",
};

export const mockPost = {
  id: "1",
  content: "Test post content",
  authorId: "1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Custom Jest matchers can be added here
export * from "@testing-library/react";
export { customRender as render };
