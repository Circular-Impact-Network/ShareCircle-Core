'use client';

import { useState } from 'react';
import { useUserSync } from '@/hooks/useUserSync';
import { AppTour } from '@/components/tour/app-tour';
import { PushOptInPrompt } from '@/components/notifications/push-opt-in-prompt';
import { HelpBot } from '@/components/help/help-bot';

// Side-effect island alongside the server-rendered authenticated layout, so the whole route tree
// does not wait on a client-side useSession() round-trip. It also hosts the three things that are
// app-wide rather than page-specific: the guided tour, the push prompt and the help assistant.
export function AuthenticatedClientShell() {
	useUserSync();

	// The tour and the push prompt both want the screen on a user's first visit. Running them at
	// once would put a permission card behind a spotlight overlay, so the prompt waits for the tour
	// to finish — including the case where the tour decides not to run at all and resolves at once.
	const [tourDone, setTourDone] = useState(false);

	return (
		<>
			<AppTour onFinished={() => setTourDone(true)} />
			<PushOptInPrompt ready={tourDone} />
			<HelpBot />
		</>
	);
}
