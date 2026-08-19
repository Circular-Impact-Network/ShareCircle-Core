import type { ReactNode } from 'react';
import { FingerprintProvider as FingerprintAgentProvider } from '@fingerprint/react';

/**
 * Device intelligence, started once for the whole application.
 *
 * The SDK's own provider carries `'use client'`, so importing it from this server component is what
 * creates the client boundary. The agent is never instantiated during SSR, and no page has to become
 * a client component to get it.
 *
 * Changing `NEXT_PUBLIC_FINGERPRINT_API_KEY` needs a rebuild, not just a restart — but not for the
 * usual reason. Because this is a server component the key is not inlined into a client bundle; it is
 * passed as a prop, which means it is baked into the prerendered RSC payload of every static page
 * (verified: the built key appears in 38 files under .next/server, including signup.rsc). Set it on
 * the host, restart only, and those pages keep serving the old value.
 *
 * The key is public by design — it is meant to be visible to the client, and it is the Dashboard's
 * request filtering, not secrecy, that stops it being used from other origins.
 *
 * When the key is absent the children are returned untouched rather than handing the SDK an
 * `undefined` key. This wraps the entire app from the root layout, so a missing environment variable
 * must degrade to "no device intelligence" and never to a blank page.
 *
 * Two other files have to stay in step with this one, and the agent fails in a way that points
 * nowhere near either of them if they do not:
 *
 * - `next.config.ts` allowlists `https://fpnpmcdn.net` in `script-src`, `https://api.fpjs.io` in
 *   `connect-src`, and `blob:` in `worker-src` for the agent's collection worker. Tighten the policy
 *   without updating it there and the agent throws `csp_block`.
 * - `public/sw-extra.js` excludes those hosts from the service worker. Any Workbox strategy applied
 *   to them breaks identification outright, with no CSP violation to explain it.
 *
 * Nothing in the app calls `get()` yet, so no visitor is identified and no API call is billed until a
 * consumer is added — `useVisitorData()` from this package, at whatever moment identification is
 * actually wanted.
 */
const API_KEY = process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY;

export function FingerprintProvider({ children }: { children: ReactNode }) {
	if (!API_KEY) {
		return <>{children}</>;
	}

	return (
		<FingerprintAgentProvider apiKey={API_KEY} region="us">
			{children}
		</FingerprintAgentProvider>
	);
}
