import type { Request } from 'express';

export function getRouteLabel(req: Request): string {
  const baseUrl = req.baseUrl ?? '';
  const routePath = req.route?.path ?? '';
  let route = `${baseUrl}${routePath}`;
  if (!route) {
    return 'unmatched';
  }
  if (route.endsWith('/') && route !== '/') {
    route = route.slice(0, -1);
  }
  return route;
}
