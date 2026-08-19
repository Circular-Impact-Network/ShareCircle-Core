import type { ReactNode } from 'react';
import { FingerprintProvider as FingerprintAgentProvider } from '@fingerprint/react';

/**
 * Device intelligence, started once for the whole application.
 *
 * The SDK's own provider carries `'use client'`, so importing it from this server component is what
 * creates the client boundary. The agent is never instantiated during SSR, and no page has to become
 * a client component to get it.
 */
const API_KEY = process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY as string;

export function FingerprintProvider({ children }: { children: ReactNode }) {
	return (
		<FingerprintAgentProvider apiKey={API_KEY} region="us">
			{children}
		</FingerprintAgentProvider>
	);
}
