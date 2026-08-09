/**
 * What the guided tour points at, per layout.
 *
 * The order is the order a new account has to do things in, not the order the navigation happens to
 * be in. That distinction is the whole point of the tour: ShareCircle does nothing useful until you
 * are in a circle, because every item is private to one — so somebody who lists an item first sees
 * an empty Browse and concludes the app is broken. Circles therefore comes first and says plainly
 * that it is the starting point.
 *
 * Desktop and mobile need genuinely different lists rather than one list with different copy: the
 * sidebar does not exist on a phone and the bottom bar does not exist on a computer, so a shared
 * list would spend half its steps pointing at nothing.
 *
 * Anchors are `data-tour` attributes rather than classes or ids. Class names change whenever
 * somebody restyles a component, and a tour that silently stops finding its target is worse than no
 * tour — this way the anchor is visibly load-bearing to anyone editing the markup.
 */

export type TourStep = {
	/** Value of the `data-tour` attribute on the element to highlight. */
	anchor: string;
	title: string;
	description: string;
	/**
	 * Opens the help assistant when the user advances past this step.
	 *
	 * The closing step highlights a control inside the assistant panel, which does not exist while
	 * the panel is shut. Rather than describing where the control would be, the tour opens the
	 * panel and points at the real thing.
	 */
	opensHelpPanel?: boolean;
	/**
	 * Exempt from the "is it on the page?" filter, because it only appears once an earlier step has
	 * opened the panel. Without this the closing step would be dropped before the tour even starts.
	 */
	appearsLater?: boolean;
};

export type TourPlatform = 'desktop' | 'mobile';

const STEP_HOME: TourStep = {
	anchor: 'nav-home',
	title: 'Welcome to ShareCircle',
	description:
		'Borrow what you need from people you trust, and lend what you are not using. This is Home — whatever needs your attention shows up here. Let us walk through getting started.',
};

const STEP_CIRCLES: TourStep = {
	anchor: 'nav-circles',
	title: 'Start here: join or create a circle',
	description:
		'A circle is a private group — neighbours, friends, colleagues. Everything in ShareCircle happens inside one, so nothing is shared and nothing is visible until you belong to at least one. Create a circle and invite people, or join with a code someone sent you.',
};

const STEP_BROWSE: TourStep = {
	anchor: 'nav-browse',
	title: 'Then find something to borrow',
	description:
		'Browse shows everything shared into your circles. Open an item and choose Request Access to ask the owner. If nobody has what you need, Request Item asks your circles for it.',
};

const STEP_HELP: TourStep = {
	anchor: 'help-bot',
	title: 'Stuck at any point? Just ask',
	description:
		'The assistant answers questions about how ShareCircle works, any time. Open it and there are two more things inside.',
	opensHelpPanel: true,
};

const STEP_REPLAY: TourStep = {
	anchor: 'replay-tour',
	title: 'And you can watch this again',
	description:
		'Replay tour brings this walkthrough back whenever you want it, and Help guide opens the full written guide. Both live here, inside the assistant.',
	appearsLater: true,
};

const DESKTOP_STEPS: TourStep[] = [
	STEP_HOME,
	STEP_CIRCLES,
	{
		anchor: 'nav-listings',
		title: 'Next, list something you own',
		description:
			'Add an item from a photo and the details are filled in for you. Remember to share it into a circle — an item in no circle is invisible to everybody, which is the single most common reason a listing seems to disappear.',
	},
	STEP_BROWSE,
	{
		anchor: 'nav-activity',
		title: 'Keep track of it all',
		description:
			'My Activity holds the requests you have sent, what you have borrowed and lent, your place in any queue, and your history.',
	},
	STEP_HELP,
	STEP_REPLAY,
];

const MOBILE_STEPS: TourStep[] = [
	STEP_HOME,
	STEP_CIRCLES,
	STEP_BROWSE,
	{
		anchor: 'mobile-menu',
		title: 'List an item, and track your activity',
		description:
			'My Listings and My Activity live behind your avatar, along with Help and Settings. Add an item from a photo, and remember to share it into a circle — an item in no circle is invisible to everybody.',
	},
	STEP_HELP,
	STEP_REPLAY,
];

export function getTourSteps(platform: TourPlatform): TourStep[] {
	return platform === 'mobile' ? MOBILE_STEPS : DESKTOP_STEPS;
}

/**
 * Drop steps whose anchor is not on the page.
 *
 * A step pointing at a missing element would either highlight nothing or halt the tour partway.
 * Neither is acceptable for something a new user meets in their first minute, and elements do
 * legitimately go missing — a narrow window, a feature behind a flag, a page still loading.
 */
export function selectPresentSteps(steps: TourStep[], isPresent: (anchor: string) => boolean): TourStep[] {
	const anchored = steps.filter(step => !step.appearsLater && isPresent(step.anchor));

	// Nothing anchored means the shell has not painted, so there is no tour to run — and in that
	// case the deferred steps must go too. Keeping them would leave a tour made entirely of steps
	// pointing at controls that nothing on screen can open.
	if (anchored.length === 0) {
		return [];
	}

	// A deferred step is only reachable because an earlier step opens the panel it lives in. If that
	// opener was itself dropped, the deferred step has nothing to bring it on screen, and driver.js
	// does not skip a step whose element is missing — it centres the popover over a placeholder. The
	// tour would end on a modal describing two buttons that are nowhere to be seen.
	const opensAPanel = anchored.some(step => step.opensHelpPanel);

	return steps.filter(step => (step.appearsLater ? opensAPanel : isPresent(step.anchor)));
}
