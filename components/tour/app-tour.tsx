'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { getTourSteps, selectPresentSteps, type TourPlatform } from '@/lib/tour-steps';

/** Mirrors the account flag so the tour does not flash before the session resolves. */
const LOCAL_KEY = 'sharecircle_tour_completed';

type AppTourProps = {
	/** Raised once the tour has ended, so the push prompt can take its turn. */
	onFinished: () => void;
};

function readLocalCompleted(): boolean {
	try {
		return window.localStorage.getItem(LOCAL_KEY) === '1';
	} catch {
		return false;
	}
}

function writeLocalCompleted(): void {
	try {
		window.localStorage.setItem(LOCAL_KEY, '1');
	} catch {
		// The account flag is the real record; this is only here to avoid a flash on reload.
	}
}

function currentPlatform(): TourPlatform {
	return window.matchMedia('(min-width: 1024px)').matches ? 'desktop' : 'mobile';
}

/**
 * The guided tour, driven by driver.js.
 *
 * driver.js is a small vanilla-DOM library rather than a React one, deliberately: the React tour
 * packages carry peer ranges that fight React 19, and the fiddly parts here — the spotlight cut-out,
 * scrolling a target into view, repositioning on resize — are exactly what is tedious to hand-roll
 * and boring once delegated. It is wrapped in this one component so replacing it later touches a
 * single file.
 */
export function AppTour({ onFinished }: AppTourProps) {
	const driverRef = useRef<Driver | null>(null);
	const [ready, setReady] = useState(false);

	// Kept in a ref so the driver callbacks, which are created once when the tour starts, always see
	// the current callback. Written in an effect rather than during render: a ref write while
	// rendering is a side effect, and React may render without committing.
	const finishRef = useRef(onFinished);
	useEffect(() => {
		finishRef.current = onFinished;
	}, [onFinished]);

	const markCompleted = useCallback(() => {
		writeLocalCompleted();
		// Fire and forget: a failed write costs a repeated tour, not correctness, and blocking the
		// user's first minute on a request would be a poor trade.
		void fetch('/api/tour', { method: 'POST', credentials: 'include' }).catch(error =>
			console.error('Failed to record tour completion:', error),
		);
		finishRef.current();
	}, []);

	const start = useCallback(() => {
		const steps = selectPresentSteps(getTourSteps(currentPlatform()), anchor =>
			Boolean(document.querySelector(`[data-tour="${anchor}"]`)),
		);

		// Every anchor missing means the shell has not painted yet, or this layout has none of them.
		// Starting an empty tour would show a stray overlay with nothing highlighted.
		if (steps.length === 0) {
			markCompleted();
			return;
		}

		const instance = driver({
			showProgress: true,
			progressText: 'Step {{current}} of {{total}}',
			nextBtnText: 'Next',
			prevBtnText: 'Back',
			doneBtnText: 'Finish',
			allowClose: true,
			// Skipping must always be one obvious click away; a tour a user cannot leave is a trap.
			showButtons: ['next', 'previous', 'close'],
			overlayOpacity: 0.6,
			stagePadding: 6,
			popoverClass: 'sharecircle-tour',
			steps: steps.map(step => ({
				element: `[data-tour="${step.anchor}"]`,
				popover: { title: step.title, description: step.description },
			})),
			onDestroyed: () => markCompleted(),
		});

		driverRef.current = instance;
		instance.drive();
	}, [markCompleted]);

	useEffect(() => {
		if (readLocalCompleted()) {
			finishRef.current();
			return;
		}

		let cancelled = false;
		void (async () => {
			try {
				const res = await fetch('/api/tour', { credentials: 'include' });
				if (cancelled) {
					return;
				}
				const data = (await res.json()) as { completed?: boolean };
				if (data.completed) {
					writeLocalCompleted();
					finishRef.current();
					return;
				}
				setReady(true);
			} catch {
				// If we cannot tell, do not tour: an unexpected overlay is worse than a missing one.
				finishRef.current();
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!ready) {
			return;
		}
		// One frame of delay so the nav has painted and its anchors exist to be measured.
		const timer = window.setTimeout(start, 600);
		return () => {
			window.clearTimeout(timer);
			driverRef.current?.destroy();
		};
	}, [ready, start]);

	return null;
}

/**
 * Replays the tour on demand, from Settings.
 *
 * Separate from the automatic run because it must ignore the completion flag entirely — the whole
 * point is that somebody who finished it once wants to see it again.
 */
export function startTourManually(): void {
	try {
		window.localStorage.removeItem(LOCAL_KEY);
	} catch {
		// Falls through to the driver below regardless.
	}

	const steps = selectPresentSteps(getTourSteps(currentPlatform()), anchor =>
		Boolean(document.querySelector(`[data-tour="${anchor}"]`)),
	);

	if (steps.length === 0) {
		return;
	}

	driver({
		showProgress: true,
		progressText: 'Step {{current}} of {{total}}',
		nextBtnText: 'Next',
		prevBtnText: 'Back',
		doneBtnText: 'Finish',
		showButtons: ['next', 'previous', 'close'],
		overlayOpacity: 0.6,
		stagePadding: 6,
		popoverClass: 'sharecircle-tour',
		steps: steps.map(step => ({
			element: `[data-tour="${step.anchor}"]`,
			popover: { title: step.title, description: step.description },
		})),
	}).drive();
}
