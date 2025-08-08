import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

// Root state is inferred from the configured store (see AppState below)

// Temporary dummy reducer until we have real slices
const dummyReducer = (state = {}) => {
  return state;
};

// Create the store
export const store = configureStore({
  reducer: {
    // Temporary dummy reducer to prevent warnings
    dummy: dummyReducer,
    // Add your reducers here as they're created
    // Example:
    // auth: authReducer,
    // posts: postsReducer,
    // users: usersReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ["persist/PERSIST"],
        // Ignore these field paths in all actions
        ignoredActionPaths: ["meta.arg", "payload.timestamp"],
        // Ignore these paths in the state
        ignoredPaths: ["items.dates"],
      },
    }),
  devTools: process.env.NODE_ENV !== "production",
});

// Export types for use throughout the app
export type AppDispatch = typeof store.dispatch;
export type AppState = ReturnType<typeof store.getState>;

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;
