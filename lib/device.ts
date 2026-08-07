/**
 * Device-class detection, used to keep the PWA install prompt on phones only.
 *
 * Two independent signals, because neither alone is sufficient:
 *
 *  1. Platform. `navigator.userAgentData.platform` (Chromium) or the UA string. A Windows /
 *     macOS / Linux / Chrome OS platform is a desktop, full stop.
 *  2. Input capability — a precise pointer AND real hover.
 *
 * Signal 2 was the only check here originally, and it misclassifies a Windows touchscreen
 * laptop or a machine in tablet mode as mobile: those report `pointer: coarse` and
 * `hover: none`, so our install card appeared on exactly the Windows/Edge desktops it was
 * supposed to exclude. Platform is checked first for that reason.
 *
 * Note the asymmetry in the fallback: when nothing is conclusive we return 'mobile' from
 * the media query, because wrongly withholding install from a real phone is a worse failure
 * than wrongly offering it on an exotic desktop — and the manifest gate (see
 * app/manifest.webmanifest/route.ts) is the belt to this braces.
 */

export const DESKTOP_MEDIA_QUERY = '(pointer: fine) and (hover: hover)';

export type DeviceKind = 'unknown' | 'mobile' | 'desktop';

/** Desktop operating systems as reported by userAgentData.platform. */
const DESKTOP_PLATFORMS = ['windows', 'macos', 'mac os', 'linux', 'chrome os', 'chromeos'];

/** UA substrings that mean "phone or tablet" even on an otherwise desktop-looking platform. */
const MOBILE_UA_PATTERN = /Android|iPhone|iPad|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini|Mobile Safari/i;

/** UA substrings that mean "desktop OS". Checked only when no mobile token is present. */
const DESKTOP_UA_PATTERN = /Windows NT|Macintosh|X11|CrOS|Linux x86_64/i;

/**
 * Classifies a user-agent string (plus optional Client Hints platform) as desktop or mobile.
 * Returns null when neither is conclusive, so the caller can fall back to input capability.
 *
 * Shared by the client hook and the server-side manifest route — the two must not be able to
 * disagree about what "desktop" means.
 */
export function classifyUserAgent(userAgent: string, platformHint?: string | null): 'mobile' | 'desktop' | null {
	// A mobile token wins outright. iPadOS Safari reports "Macintosh", but it also reports
	// touch points, which is handled by the caller's capability fallback.
	if (MOBILE_UA_PATTERN.test(userAgent)) {
		return 'mobile';
	}

	if (platformHint) {
		const platform = platformHint.toLowerCase();
		if (DESKTOP_PLATFORMS.some(candidate => platform.includes(candidate))) {
			return 'desktop';
		}
	}

	if (DESKTOP_UA_PATTERN.test(userAgent)) {
		return 'desktop';
	}

	return null;
}

type UserAgentData = { mobile?: boolean; platform?: string };

/**
 * Resolves the device class. Returns 'unknown' when there is no window or matchMedia
 * (SSR, jsdom without a stub) — callers must treat 'unknown' as "do not show yet" so a
 * desktop never flashes a mobile-only UI on first paint.
 */
export function detectDeviceKind(): DeviceKind {
	if (typeof window === 'undefined' || typeof navigator === 'undefined') {
		return 'unknown';
	}

	const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;

	// Chromium's own answer, when available. Most trustworthy signal we have: it is not
	// spoofable by the same UA-string tricks and it is what Chrome/Edge themselves use.
	if (uaData && typeof uaData.mobile === 'boolean') {
		return uaData.mobile ? 'mobile' : 'desktop';
	}

	const userAgent = navigator.userAgent || '';
	const classified = classifyUserAgent(userAgent, uaData?.platform ?? null);
	if (classified) {
		// iPadOS Safari lies about being a Mac, so a touch-capable, hover-less "Macintosh" is
		// really a tablet — and tablets are home-screen devices.
		//
		// Scoped to the Macintosh UA deliberately. Applying it to every desktop-classified
		// device inverted the primary fix: a Windows touchscreen laptop reports
		// maxTouchPoints > 1 with no hover, so the broad form sent it straight back to
		// 'mobile' — the exact case this function exists to catch. Windows/Linux/CrOS user
		// agents are unambiguous and must never be downgraded by touch capability.
		const couldBeIpadMasqueradingAsMac = /Macintosh/i.test(userAgent);
		if (
			classified === 'desktop' &&
			couldBeIpadMasqueradingAsMac &&
			navigator.maxTouchPoints > 1 &&
			!matchesDesktopCapability()
		) {
			return 'mobile';
		}
		return classified;
	}

	if (typeof window.matchMedia !== 'function') {
		return 'unknown';
	}
	return matchesDesktopCapability() ? 'desktop' : 'mobile';
}

function matchesDesktopCapability(): boolean {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return false;
	}
	return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

export function isDesktopDevice(): boolean {
	return detectDeviceKind() === 'desktop';
}
