'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { getTourSteps, selectPresentSteps, type TourStep, type TourPlatform } from '@/lib/tour-steps';

/**
 * Duplicated rather than imported from the help bot, which imports this module for its Replay
 * button — importing back would be a cycle. One constant is a smaller price than that.
 */
const HELP_BOT_OPEN_EVENT = 'sharecircle:open-help-bot';
const HELP_BOT_CLOSE_EVENT = 'sharecircle:close-help-bot';

/**
 * Options shared by the automatic run and the manual replay.
 *
 * Two things here are corrections rather than preferences:
 *
 * `overlayClickBehavior` is a no-op rather than the default `'close'`. driver.js gives the overlay
 * `pointer-events: auto` inline, so any click on the dimmed area ended the tour — and ending the
 * tour records completion for the account, on every device, forever. Tapping the background is the
 * first reflex when an unexpected overlay appears, so a new user's entire onboarding could be
 * destroyed by one stray tap. Escape and the X still close it, so skipping remains one obvious
 * action; it just has to be a deliberate one.
 *
 * `disableActiveInteraction` stops the highlighted element from being clickable. driver.js
 * otherwise leaves exactly one live control on the page — the one being pointed at — so a user
 * following the instruction to open the avatar menu got a menu whose every row was inert, because
 * the menu portals outside the highlighted element and inherits `pointer-events: none`. Their click
 * then landed on the overlay and killed the tour.
 */
const TOUR_OPTIONS = {
	showProgress: true,
	progressText: 'Step {{current}} of {{total}}',
	nextBtnText: 'Next',
	prevBtnText: 'Back',
	doneBtnText: 'Finish',
	// Skipping must always be one obvious click away; a tour a user cannot leave is a trap.
	showButtons: ['next', 'previous', 'close'] as const,
	allowClose: true,
	overlayClickBehavior: () => {},
	disableActiveInteraction: true,
	overlayOpacity: 0.6,
	stagePadding: 6,
	popoverClass: 'sharecircle-tour',
};

/**
 * Turn the step list into driver.js steps.
 *
 * The closing step highlights a control inside the assistant panel, so the step before it opens the
 * panel and then advances a beat later — long enough for React to render the control the next step
 * is about to point at.
 */
function toDriverSteps(steps: TourStep[], getDriver: () => Driver | null) {
	return steps.map((step, index) => ({
		// The resolved element, not the selector: driver.js would otherwise re-query and find the
		// hidden copy in the other layout.
		element: findVisibleAnchor(step.anchor) ?? `[data-tour="${step.anchor}"]`,
		popover: {
			title: step.title,
			description: step.description,
			...(step.opensHelpPanel
				? {
						onNextClick: () => {
							window.dispatchEvent(new Event(HELP_BOT_OPEN_EVENT));
							// Deferred so React can render the control the next step points at — and
							// guarded, because driver.js does not debounce its own Next button. Two
							// quick clicks scheduled two advances: the first moved to the closing step
							// and the second ran off the end of the list, which destroys the tour and
							// records it as complete. The user lost the step explaining how to replay
							// it, and with it the only way to get it back.
							window.setTimeout(() => {
								const instance = getDriver();
								if (instance?.getActiveIndex() === index) {
									instance.moveNext();
								}
							}, 220);
						},
					}
				: {}),
		},
	}));
}

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

/**
 * The element a step should point at, choosing the visible one when both layouts render it.
 *
 * Both navigations are always in the DOM: the sidebar is `hidden lg:flex` and the bottom bar is
 * `lg:hidden`, so only CSS decides which is on screen. `querySelector` returns the first match in
 * document order regardless of visibility, which on a phone is the hidden sidebar link — and
 * driver.js would then spotlight a box of zero size somewhere off screen.
 *
 * `getClientRects()` is the test rather than `offsetParent`, because both navigations are
 * `position: fixed` and a fixed element reports a null `offsetParent` even when perfectly visible.
 */
function findVisibleAnchor(anchor: string): HTMLElement | null {
	const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`);
	for (const candidate of candidates) {
		if (candidate.getClientRects().length > 0) {
			return candidate;
		}
	}
	return null;
}

/**
 * Which layout is actually on screen.
 *
 * Asks the DOM rather than the viewport width. A media query here would be a second copy of the
 * breakpoint, free to drift from the one in the classes that do the hiding; asking whether the
 * sidebar is visible cannot drift, and it stays correct in a responsive-mode window too.
 *
 * `?tour=mobile` or `?tour=desktop` forces a layout, for looking at the other one without a device.
 */
function currentPlatform(): TourPlatform {
	const forced = new URLSearchParams(window.location.search).get('tour');
	if (forced === 'mobile' || forced === 'desktop') {
		return forced;
	}

	const sidebar = document.querySelector<HTMLElement>('[data-tour-layout="sidebar"]');
	return sidebar && sidebar.getClientRects().length > 0 ? 'desktop' : 'mobile';
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
		const steps = selectPresentSteps(getTourSteps(currentPlatform()), anchor => Boolean(findVisibleAnchor(anchor)));

		// Every anchor missing means the shell has not painted yet, or this layout has none of them.
		// Starting an empty tour would show a stray overlay with nothing highlighted.
		if (steps.length === 0) {
			markCompleted();
			return;
		}

		const instance = driver({
			...TOUR_OPTIONS,
			showButtons: [...TOUR_OPTIONS.showButtons],
			steps: toDriverSteps(steps, () => driverRef.current),
			onDestroyed: () => {
				// The closing steps open the assistant panel and never close it, so the push prompt
				// that takes its turn next rendered directly on top of the two buttons the last step
				// had just introduced. Both are anchored to the same corner.
				window.dispatchEvent(new Event(HELP_BOT_CLOSE_EVENT));
				markCompleted();
			},
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
	// The completion flag is deliberately left alone. Clearing it used to be how this ignored it,
	// but nothing wrote it back — so once the account's own flag failed to save (a fire-and-forget
	// POST), the introductory tour started launching itself on every page load with no way to stop
	// it. This function simply never consults the flag, which is all it ever needed to do.

	// A replay can be started from inside a tour: the last step highlights the Replay button, and
	// the highlighted element is clickable. Without this, a second driver mounted its own overlay
	// and popover on top of the first — two tours, a doubly dimmed page, and a stale overlay left
	// behind whichever one was dismissed second.
	activeManual?.destroy();
	activeManual = null;

	const steps = selectPresentSteps(getTourSteps(currentPlatform()), anchor => Boolean(findVisibleAnchor(anchor)));

	if (steps.length === 0) {
		return;
	}

	const manual = driver({
		...TOUR_OPTIONS,
		showButtons: [...TOUR_OPTIONS.showButtons],
		steps: toDriverSteps(steps, () => activeManual),
		onDestroyed: () => {
			window.dispatchEvent(new Event(HELP_BOT_CLOSE_EVENT));
			activeManual = null;
		},
	});
	activeManual = manual;
	manual.drive();
}

/** The replay instance, so a second replay replaces it rather than stacking on top of it. */
let activeManual: Driver | null = null;
