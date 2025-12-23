type FetchWrapper = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response;

describe("api-client fetch wrapper", () => {
  const originalRequest = global.Request;

  const setup = async (options: { stateChanging: boolean; token: string | null }) => {
    let capturedFetch: FetchWrapper | undefined;
    let csrfMock:
      | {
          CSRF_HEADER_NAME: string;
          getCsrfTokenFromCookie: jest.Mock;
          isStateChangingMethod: jest.Mock;
        }
      | undefined;

    await jest.isolateModulesAsync(async () => {
      jest.doMock("openapi-fetch", () => ({
        __esModule: true,
        default: (config: { fetch: FetchWrapper }) => {
          capturedFetch = config.fetch;
          return {
            GET: jest.fn(),
            POST: jest.fn(),
            PUT: jest.fn(),
            DELETE: jest.fn(),
          };
        },
      }));

      jest.doMock("./csrf", () => {
        csrfMock = {
          CSRF_HEADER_NAME: "x-csrf-token",
          getCsrfTokenFromCookie: jest.fn(() => options.token),
          isStateChangingMethod: jest.fn(() => options.stateChanging),
        };
        return csrfMock;
      });

      jest.doMock("./api-error", () => ({
        getApiErrorMessage: jest.fn(() => "error"),
      }));

      await import("./api-client");
    });

    if (!capturedFetch || !csrfMock) {
      throw new Error("Failed to capture fetch wrapper");
    }

    return { fetchWrapper: capturedFetch, csrfMock };
  };

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    global.Request = originalRequest;
  });

  it("wraps non-Request inputs in a Request", async () => {
    const { fetchWrapper } = await setup({ stateChanging: false, token: null });
    global.fetch = jest.fn();

    await fetchWrapper("/api/bff/test", { method: "GET" });

    const req = (global.fetch as jest.Mock).mock.calls[0][0] as Request;
    expect(req).toBeInstanceOf(Request);
    expect(req.method).toBe("GET");
  });

  it("rebuilds Request when init is provided and adds CSRF header", async () => {
    const { fetchWrapper } = await setup({ stateChanging: true, token: "token-123" });
    global.fetch = jest.fn();

    const base = new Request("/api/bff/test", { method: "POST" });
    await fetchWrapper(base, { headers: { "x-custom": "1" } });

    const req = (global.fetch as jest.Mock).mock.calls[0][0] as Request;
    expect(req.headers.get("x-csrf-token")).toBe("token-123");
    expect(req.headers.get("x-custom")).toBe("1");
  });

  it("reuses Request instance when init is missing", async () => {
    const { fetchWrapper } = await setup({ stateChanging: false, token: null });
    global.fetch = jest.fn();

    const base = new Request("/api/bff/test", { method: "GET" });
    await fetchWrapper(base);

    const req = (global.fetch as jest.Mock).mock.calls[0][0] as Request;
    expect(req).toBe(base);
  });

  it("falls back to init.method when request.method is empty", async () => {
    const { fetchWrapper, csrfMock } = await setup({ stateChanging: false, token: null });
    global.fetch = jest.fn();

    global.Request = class FakeRequest {
      method: string;
      headers = new Headers();

      constructor(_input: RequestInfo | URL, init?: RequestInit) {
        this.method = init?.method ?? "";
      }
    } as unknown as typeof Request;

    await fetchWrapper("/api/bff/test", { method: "PATCH" });

    expect(csrfMock.isStateChangingMethod).toHaveBeenCalledWith("PATCH");
  });

  it("defaults to GET when both request.method and init.method are empty", async () => {
    const { fetchWrapper, csrfMock } = await setup({ stateChanging: false, token: null });
    global.fetch = jest.fn();

    global.Request = class FakeRequest {
      method = "";
      headers = new Headers();

      constructor() {}
    } as unknown as typeof Request;

    await fetchWrapper("/api/bff/test");

    expect(csrfMock.isStateChangingMethod).toHaveBeenCalledWith("GET");
  });
});
