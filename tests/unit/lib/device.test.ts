import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_MEDIA_QUERY, classifyUserAgent, detectDeviceKind, isDesktopDevice } from '@/lib/device';

/**
 * Requirement (2026-08-05): "be 100% sure that we do not allow to install app on a laptop...
 * in some browser and OS combination (Bing, Windows etc), I am getting the install the app
 * popover/model in desktop as well and users are able to install it. That popup should only
 * come on MOBILE devices."
 *
 * Every stub sets `navigator` explicitly. Detection is platform-first now, so a test that
 * stubs only matchMedia silently measures happy-dom's own desktop user agent instead of the
 * device class under test.
 */
type Stub = { userAgent?: string; uaData?: { mobile?: boolean; platform?: string }; maxTouchPoints?: number };

function stubDevice({ userAgent = '', uaData, maxTouchPoints = 0 }: Stub, desktopCapability = true) {
	const matchMedia = vi.fn((query: string) => ({
		matches: query === DESKTOP_MEDIA_QUERY ? desktopCapability : false,
	}));
	vi.stubGlobal('window', { matchMedia });
	vi.stubGlobal('navigator', { userAgent, maxTouchPoints, ...(uaData ? { userAgentData: uaData } : {}) });
	return matchMedia;
}

const UA = {
	windowsEdge:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
	macChrome:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
	chromeOs:
		'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	androidChrome:
		'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
	iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
	ipadDesktopMode:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
};

describe('detectDeviceKind', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('trusts userAgentData.mobile above everything else', () => {
		stubDevice({ userAgent: UA.windowsEdge, uaData: { mobile: false, platform: 'Windows' } });
		expect(detectDeviceKind()).toBe('desktop');

		vi.unstubAllGlobals();
		stubDevice({ userAgent: UA.androidChrome, uaData: { mobile: true, platform: 'Android' } });
		expect(detectDeviceKind()).toBe('mobile');
	});

	/**
	 * The reported regression. A Windows touchscreen laptop (or a 2-in-1 in tablet mode)
	 * reports `pointer: coarse` and `hover: none`. The original capability-only check called
	 * that "mobile" and showed it the install card — exactly the Windows/Edge case reported.
	 */
	it('classifies a Windows touchscreen laptop as desktop despite coarse pointer and no hover', () => {
		stubDevice({ userAgent: UA.windowsEdge, maxTouchPoints: 10 }, false);
		expect(detectDeviceKind()).toBe('desktop');
		expect(isDesktopDevice()).toBe(true);
	});

	it.each([
		['Windows / Edge', UA.windowsEdge],
		['macOS / Chrome', UA.macChrome],
		['Linux / Firefox', UA.linuxFirefox],
		['ChromeOS', UA.chromeOs],
	])('classifies %s as desktop', (_label, userAgent) => {
		stubDevice({ userAgent });
		expect(detectDeviceKind()).toBe('desktop');
	});

	it.each([
		['Android / Chrome', UA.androidChrome],
		['iPhone / Safari', UA.iphone],
	])('classifies %s as mobile', (_label, userAgent) => {
		stubDevice({ userAgent }, false);
		expect(detectDeviceKind()).toBe('mobile');
	});

	it('treats a mobile token as decisive even when the platform hint says desktop', () => {
		// Android's UA contains "Linux", which the desktop pattern would otherwise match.
		stubDevice({ userAgent: UA.androidChrome, uaData: { platform: 'Linux' } }, false);
		expect(detectDeviceKind()).toBe('mobile');
	});

	it('treats an iPad reporting the Macintosh UA as mobile via touch points', () => {
		// iPadOS Safari lies about being a Mac. Touch-capable with no hover means tablet, and
		// tablets are home-screen devices.
		stubDevice({ userAgent: UA.ipadDesktopMode, maxTouchPoints: 5 }, false);
		expect(detectDeviceKind()).toBe('mobile');
	});

	it('still classifies a real Mac as desktop when it has hover and no touch', () => {
		stubDevice({ userAgent: UA.ipadDesktopMode, maxTouchPoints: 0 }, true);
		expect(detectDeviceKind()).toBe('desktop');
	});

	it('falls back to input capability for an unrecognised user agent', () => {
		stubDevice({ userAgent: 'SomeUnknownBrowser/1.0' }, true);
		expect(detectDeviceKind()).toBe('desktop');

		vi.unstubAllGlobals();
		stubDevice({ userAgent: 'SomeUnknownBrowser/1.0' }, false);
		expect(detectDeviceKind()).toBe('mobile');
	});

	it('reports unknown without a window', () => {
		vi.stubGlobal('window', undefined);
		// Callers must treat 'unknown' as "not yet known" so a desktop never flashes the
		// mobile-only install prompt during SSR/hydration.
		expect(detectDeviceKind()).toBe('unknown');
		expect(isDesktopDevice()).toBe(false);
	});

	it('reports unknown when neither the UA nor matchMedia can answer', () => {
		vi.stubGlobal('window', {});
		vi.stubGlobal('navigator', { userAgent: '', maxTouchPoints: 0 });
		expect(detectDeviceKind()).toBe('unknown');
	});

	it('keys the capability fallback off pointer/hover rather than viewport width', () => {
		// A narrow desktop window is still a desktop — a width-based check would wrongly
		// offer it the phone install prompt.
		const matchMedia = stubDevice({ userAgent: 'SomeUnknownBrowser/1.0' }, true);
		detectDeviceKind();
		expect(matchMedia).toHaveBeenCalledWith(DESKTOP_MEDIA_QUERY);
		expect(DESKTOP_MEDIA_QUERY).not.toMatch(/width/);
	});
});

describe('classifyUserAgent', () => {
	it('returns null when nothing is conclusive, so callers fall back to capability', () => {
		expect(classifyUserAgent('SomeUnknownBrowser/1.0')).toBeNull();
		expect(classifyUserAgent('')).toBeNull();
	});

	it('reads the Client Hints platform when the UA string is uninformative', () => {
		expect(classifyUserAgent('', 'Windows')).toBe('desktop');
		expect(classifyUserAgent('', 'macOS')).toBe('desktop');
		expect(classifyUserAgent('', 'Chrome OS')).toBe('desktop');
		expect(classifyUserAgent('', 'Android')).toBeNull();
	});

	it('is shared with the manifest route so client and server cannot disagree', () => {
		// Same function backs app/manifest.webmanifest/route.ts. If this drifts, desktop gets
		// an installable manifest while the client card stays hidden, or vice versa.
		expect(classifyUserAgent(UA.windowsEdge)).toBe('desktop');
		expect(classifyUserAgent(UA.androidChrome)).toBe('mobile');
	});
});
