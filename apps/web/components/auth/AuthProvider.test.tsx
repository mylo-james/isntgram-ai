import React from "react";
import { render } from "@testing-library/react";
import AuthProvider from "./AuthProvider";
import { useSession } from "next-auth/react";
import { useDispatch } from "react-redux";

jest.mock("next-auth/react", () => ({ useSession: jest.fn() }));
jest.mock("react-redux", () => ({ useDispatch: jest.fn() }));

describe("AuthProvider", () => {
  const mockDispatch = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
  });

  it("dispatches setUser when authenticated", () => {
    (useSession as unknown as jest.Mock).mockReturnValue({
      status: "authenticated",
      data: {
        user: { id: "1", email: "a@b.com", name: "A B", username: "ab" },
        accessToken: "token123",
      },
    });

    render(
      <AuthProvider>
        <div>children</div>
      </AuthProvider>,
    );

    expect(mockDispatch).toHaveBeenCalled();
    const types = (mockDispatch.mock.calls as unknown[][]).map(([action]) => (action as { type: string }).type);
    expect(types.some((t: string) => t.includes("auth/setUser"))).toBe(true);
    expect(types.some((t: string) => t.includes("auth/setAccessToken"))).toBe(false);
  });

  it("dispatches clearAuth when unauthenticated", () => {
    (useSession as unknown as jest.Mock).mockReturnValue({ status: "unauthenticated", data: null });

    render(
      <AuthProvider>
        <div>children</div>
      </AuthProvider>,
    );

    expect(mockDispatch).toHaveBeenCalled();
    const types = (mockDispatch.mock.calls as unknown[][]).map(([action]) => (action as { type: string }).type);
    expect(types.some((t: string) => t.includes("auth/clearAuth"))).toBe(true);
  });

  it("does not dispatch when loading", () => {
    (useSession as unknown as jest.Mock).mockReturnValue({ status: "loading", data: null });

    render(
      <AuthProvider>
        <div>children</div>
      </AuthProvider>,
    );

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
