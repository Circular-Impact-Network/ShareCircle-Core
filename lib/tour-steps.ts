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
		'The assistant answers questions about how ShareCircle works, any time. You can replay this tour from Settings whenever you like.',
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
	return steps.filter(step => isPresent(step.anchor));
}
