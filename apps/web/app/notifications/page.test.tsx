import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import NotificationsPage from "./page";

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/server-api", () => ({
  internalApi: { GET: jest.fn() },
  getApiAccessToken: jest.fn(),
  getRequestId: jest.fn(),
}));
jest.mock("@/components/legacy/LegacyNav", () => {
  return function MockLegacyNav() {
    return <div data-testid="legacy-nav" />;
  };
});
jest.mock("./NotificationsClient", () => {
  return function MockNotificationsClient({
    initialNotifications,
    initialLoadError,
  }: {
    initialNotifications: { items: Array<{ id: string }> };
    initialLoadError: boolean;
  }) {
    return (
      <div data-testid="notifications-client">
        {initialLoadError ? "error" : `items:${initialNotifications.items.length}`}
      </div>
    );
  };
});

describe("NotificationsPage", () => {
  const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;
  const authModule = jest.requireMock("@/lib/auth") as { auth: jest.Mock };
  const serverApi = jest.requireMock("@/lib/server-api") as {
    internalApi: { GET: jest.Mock };
    getApiAccessToken: jest.Mock;
    getRequestId: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedirect.mockImplementation(() => {
      throw new Error("redirect");
    });
    authModule.auth.mockResolvedValue({
      user: { id: "viewer-1", username: "viewer" },
    });
    serverApi.getApiAccessToken.mockResolvedValue("access-token");
    serverApi.getRequestId.mockResolvedValue("request-1");
    serverApi.internalApi.GET.mockImplementation((path: string) => {
      if (path === "/api/users/me") {
        return Promise.resolve({
          data: { profilePictureUrl: null },
          response: { ok: true, status: 200 },
        });
      }
      if (path === "/api/notifications") {
        return Promise.resolve({
          data: { items: [], nextCursor: undefined },
          response: { ok: true, status: 200 },
        });
      }
      throw new Error(`Unexpected endpoint: ${path}`);
    });
  });

  it("preserves the authentication redirect before requests", async () => {
    authModule.auth.mockResolvedValue(null);

    await expect(NotificationsPage()).rejects.toThrow("redirect");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(serverApi.internalApi.GET).not.toHaveBeenCalled();
  });

  it("keeps a valid empty inbox distinct from an initial notification failure", async () => {
    render(await NotificationsPage());
    expect(screen.getByTestId("notifications-client")).toHaveTextContent("items:0");

    serverApi.internalApi.GET.mockImplementation((path: string) => {
      if (path === "/api/users/me") {
        return Promise.resolve({
          data: { profilePictureUrl: null },
          response: { ok: true, status: 200 },
        });
      }
      return Promise.resolve({
        data: null,
        response: { ok: false, status: 503 },
      });
    });

    render(await NotificationsPage());
    expect(screen.getAllByTestId("notifications-client")[1]).toHaveTextContent("error");
  });
});
