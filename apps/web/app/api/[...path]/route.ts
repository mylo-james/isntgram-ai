function getProxyApiBaseUrl(): string {
  // For server-side proxying we must target the API service directly (not same-origin),
  // otherwise we would create a proxy loop.
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

function buildTargetUrl(request: Request, pathSegments: string[]): URL {
  const incoming = new URL(request.url);
  const base = getProxyApiBaseUrl();
  const target = new URL(`/api/${pathSegments.join("/")}`, base);
  target.search = incoming.search;
  return target;
}

function filteredRequestHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("accept-encoding");
  return headers;
}

function filteredResponseHeaders(response: Response): Headers {
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  return headers;
}

type ProxyRequestInit = RequestInit & { duplex?: "half" };

async function proxy(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const targetUrl = buildTargetUrl(request, path);

  const init: ProxyRequestInit = {
    method: request.method,
    headers: filteredRequestHeaders(request),
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    // Node.js fetch requires duplex when streaming a body.
    init.duplex = "half";
  }

  const res = await fetch(targetUrl, init);

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: filteredResponseHeaders(res),
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
