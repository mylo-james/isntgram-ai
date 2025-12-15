import React from "react";
import { render, waitFor } from "@testing-library/react";
import AuthProvider from "./AuthProvider";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/api-client";

jest.mock("next-auth/react", () => ({ useSession: jest.fn() }));
jest.mock("@/lib/api-client", () => ({ apiClient: { setBearerToken: jest.fn() } }));

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("sets API bearer token when authenticated", async () => {
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

    await waitFor(() => {
      expect(apiClient.setBearerToken).toHaveBeenCalledWith("token123");
    });
  });

  it("clears API bearer token when unauthenticated", async () => {
    (useSession as unknown as jest.Mock).mockReturnValue({ status: "unauthenticated", data: null });

    render(
      <AuthProvider>
        <div>children</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(apiClient.setBearerToken).toHaveBeenCalledWith(null);
    });
  });

  it("does not change token when loading", () => {
    (useSession as unknown as jest.Mock).mockReturnValue({ status: "loading", data: null });

    render(
      <AuthProvider>
        <div>children</div>
      </AuthProvider>,
    );

    expect(apiClient.setBearerToken).not.toHaveBeenCalled();
  });
});
