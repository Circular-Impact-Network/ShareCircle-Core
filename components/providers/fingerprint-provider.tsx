import type { ReactNode } from 'react';
import { FingerprintProvider as FingerprintAgentProvider } from '@fingerprint/react';

/**
 * Device intelligence, started once for the whole application.
 *
 * The SDK's own provider carries `'use client'`, so importing it from this server component is what
 * creates the client boundary. The agent is never instantiated during SSR, and no page has to become
 * a client component to get it.
 *
 * When the key is absent the children are returned untouched rather than handing the SDK an
 * `undefined` key. This wraps the entire app from the root layout, so a missing environment variable
 * must degrade to "no device intelligence" and never to a blank page.
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
