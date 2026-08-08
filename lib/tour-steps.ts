/**
 * What the guided tour points at, per layout.
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

const SHARED_CLOSING: TourStep[] = [
	{
		anchor: 'help-bot',
		title: 'Stuck? Just ask',
		description:
			'The assistant answers questions about how ShareCircle works, any time. The full help guide lives here too.',
	},
];

const DESKTOP_STEPS: TourStep[] = [
	{
		anchor: 'nav-home',
		title: 'Your home base',
		description: 'A summary of what needs your attention: requests waiting on you, and items on loan.',
	},
	{
		anchor: 'nav-browse',
		title: 'Find something to borrow',
		description: 'Everything shared into your circles. Search it, or ask for something nobody has listed yet.',
	},
	{
		anchor: 'nav-circles',
		title: 'Your circles',
		description:
			'Circles are private groups you share within. Create one and invite people, or join with an invite code.',
	},
	{
		anchor: 'nav-listings',
		title: 'List what you own',
		description:
			'Add an item from a photo and the app fills in the details for you. Nothing is visible until you share it into a circle.',
	},
	{
		anchor: 'nav-activity',
		title: 'Track your borrowing',
		description: 'Borrow requests you sent and received, items currently out, your queue, and your history.',
	},
	...SHARED_CLOSING,
];

const MOBILE_STEPS: TourStep[] = [
	{
		anchor: 'nav-home',
		title: 'Your home base',
		description: 'A summary of what needs your attention: requests waiting on you, and items on loan.',
	},
	{
		anchor: 'nav-browse',
		title: 'Find something to borrow',
		description: 'Everything shared into your circles. Search it, or ask for something nobody has listed yet.',
	},
	{
		anchor: 'nav-circles',
		title: 'Your circles',
		description:
			'Circles are private groups you share within. Create one and invite people, or join with an invite code.',
	},
	{
		anchor: 'mobile-menu',
		title: 'Everything else is here',
		description: 'My Listings, My Activity, Help and Settings live behind your avatar.',
	},
	...SHARED_CLOSING,
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
