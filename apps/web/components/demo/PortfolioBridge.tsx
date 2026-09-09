'use client';

import { useEffect } from 'react';
import { acceptsPortfolioParent, isPortfolioReadyRequest, PORTFOLIO_PROJECT, PORTFOLIO_PROTOCOL_VERSION, PORTFOLIO_READY } from '@/lib/portfolio-protocol';

/** The portfolio learns only that this child UI has rendered. This does not
 * establish API health or login state, and accepts no session or tour command. */
export default function PortfolioBridge() {
  const parentOrigin = process.env.NEXT_PUBLIC_PORTFOLIO_ORIGIN || '';

  useEffect(() => {
    if (!parentOrigin || window.parent === window) return;
    const parent = window.parent;
    document.documentElement.setAttribute('data-portfolio-embedded', '');
    const announceReady = () => parent.postMessage({ type: PORTFOLIO_READY, version: PORTFOLIO_PROTOCOL_VERSION, project: PORTFOLIO_PROJECT }, parentOrigin);
    const respond = (event: MessageEvent) => {
      if (!acceptsPortfolioParent(event, parentOrigin, parent) || !isPortfolioReadyRequest(event.data)) return;
      announceReady();
    };
    window.addEventListener('message', respond);
    // The iframe load event can precede React hydration. Announce after mounting
    // as well as answering requests, so neither order loses the handshake.
    announceReady();
    return () => {
      document.documentElement.removeAttribute('data-portfolio-embedded');
      window.removeEventListener('message', respond);
    };
  }, [parentOrigin]);

  return null;
}
