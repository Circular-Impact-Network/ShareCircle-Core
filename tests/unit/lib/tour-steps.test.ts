import { describe, expect, it } from 'vitest';
import { getTourSteps, selectPresentSteps } from '@/lib/tour-steps';

describe('getTourSteps', () => {
	// The two layouts share almost no navigation, so one list cannot describe both: half its steps
	// would point at elements the current breakpoint never renders.
	it('points desktop users at the sidebar', () => {
		const anchors = getTourSteps('desktop').map(step => step.anchor);
		expect(anchors).toContain('nav-listings');
		expect(anchors).toContain('nav-activity');
		expect(anchors).not.toContain('mobile-menu');
	});

	it('points phone users at the avatar menu, where those screens actually live', () => {
		const anchors = getTourSteps('mobile').map(step => step.anchor);
		expect(anchors).toContain('mobile-menu');
		// My Listings and My Activity are not in the bottom bar, so highlighting them would fail.
		expect(anchors).not.toContain('nav-listings');
		expect(anchors).not.toContain('nav-activity');
	});

	it('ends both layouts on the assistant, then on how to replay', () => {
		for (const platform of ['desktop', 'mobile'] as const) {
			const steps = getTourSteps(platform);
			expect(steps.at(-2)?.anchor).toBe('help-bot');
			expect(steps.at(-1)?.anchor).toBe('replay-tour');
			// The replay control only exists once the panel is open, so the step before it has to
			// open the panel — otherwise the tour ends pointing at nothing.
			expect(steps.at(-2)?.opensHelpPanel).toBe(true);
			expect(steps.at(-1)?.appearsLater).toBe(true);
		}
	});

	// The tour teaches the order things must be done in, not the order the navigation is in.
	// Nothing in ShareCircle is visible until you are in a circle, so a user who lists an item
	// first meets an empty Browse and concludes the app is broken.
	it('introduces circles before anything that depends on having one', () => {
		for (const platform of ['desktop', 'mobile'] as const) {
			const anchors = getTourSteps(platform).map(step => step.anchor);
			const circles = anchors.indexOf('nav-circles');
			expect(circles).toBeGreaterThanOrEqual(0);
			for (const dependent of ['nav-browse', 'nav-listings', 'nav-activity', 'mobile-menu']) {
				const at = anchors.indexOf(dependent);
				if (at >= 0) {
					expect(at).toBeGreaterThan(circles);
				}
			}
		}
	});

	it('says why a circle comes first, rather than just naming the screen', () => {
		const circles = getTourSteps('desktop').find(step => step.anchor === 'nav-circles');
		expect(circles?.description).toMatch(/until you belong to at least one/i);
	});

	it('gives every step something to say', () => {
		for (const platform of ['desktop', 'mobile'] as const) {
			for (const step of getTourSteps(platform)) {
				expect(step.title.length).toBeGreaterThan(0);
				expect(step.description.length).toBeGreaterThan(0);
			}
		}
	});
});

describe('selectPresentSteps', () => {
	// A step whose target is absent either highlights nothing or stops the tour partway — a poor
	// first minute for a new user, and elements do go missing legitimately.
	it('drops steps whose anchor is not on the page', () => {
		const steps = getTourSteps('desktop');
		const present = selectPresentSteps(steps, anchor => anchor !== 'nav-circles');

		expect(present.map(step => step.anchor)).not.toContain('nav-circles');
		expect(present).toHaveLength(steps.length - 1);
	});

	// Deferred steps are exempt from the presence check, so the empty case needs stating: with
	// nothing on screen there is no tour, and a tour made only of steps pointing inside a panel
	// nothing can open would be worse than none.
	it('returns nothing when the shell has not rendered', () => {
		expect(selectPresentSteps(getTourSteps('mobile'), () => false)).toEqual([]);
		expect(selectPresentSteps(getTourSteps('desktop'), () => false)).toEqual([]);
	});

	it('keeps the closing step even though its control is not on screen yet', () => {
		// `replay-tour` lives inside the assistant panel, which is shut when the tour starts.
		const kept = selectPresentSteps(getTourSteps('desktop'), anchor => anchor !== 'replay-tour');
		expect(kept.map(step => step.anchor)).toContain('replay-tour');
	});

	it('keeps the original order', () => {
		const steps = getTourSteps('desktop');
		expect(selectPresentSteps(steps, () => true).map(s => s.anchor)).toEqual(steps.map(s => s.anchor));
	});
});
