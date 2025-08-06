"use client";

import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "../store/store";
import { initializeAuth } from "../store/slices/authSlice";

interface ProvidersProps {
  children: React.ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  useEffect(() => {
    // Initialize auth state from localStorage
    store.dispatch(initializeAuth());
  }, []);

  return <Provider store={store}>{children}</Provider>;
};
