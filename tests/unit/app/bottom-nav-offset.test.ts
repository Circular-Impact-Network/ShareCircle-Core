import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Anything floating above the mobile bottom navigation must clear the bar's real height.
 *
 * The fixed elements above the bar position themselves against `var(--bottom-nav-height, 4rem)` and
 * the variable was never defined anywhere, so every one of them quietly used the fallback. A CSS
 * variable that does not exist produces no error and no warning — the fallback simply wins — and
 * the fallback is wrong: the bar is `h-16` *plus* `pb-safe-bottom`, so on a phone with a gesture
 * area it stands some 50px taller than 4rem. The help launcher and the help panel's two buttons
 * were half-hidden behind it, on a phone, while a desktop viewport looked perfect because its
 * safe-area inset is zero.
 *
 * Read from the stylesheet rather than rendered: jsdom does not implement `env()`, and a device
 * with a non-zero inset is exactly the case that has to hold.
 */

const CSS = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');

const CONSUMERS = [
	['components', 'help', 'help-bot.tsx'],
	['components', 'notifications', 'push-opt-in-prompt.tsx'],
];

describe('--bottom-nav-height', () => {
	it('is still used by the components this guards, so the test cannot pass vacuously', () => {
		const uses = CONSUMERS.flatMap(segments => {
			const text = readFileSync(path.join(process.cwd(), ...segments), 'utf8');
			return [...text.matchAll(/var\(--bottom-nav-height/g)];
		});

		// Two, not three: the help launcher was the third and no longer exists as a floating element
		// — its trigger moved into the header and the sidebar, because in the bottom-right corner it
		// covered the message composer's Send button. The panel and the push prompt still float.
		expect(uses.length).toBeGreaterThanOrEqual(2);
	});

	it('is defined, so consumers are not silently falling back', () => {
		expect(CSS).toMatch(/--bottom-nav-height:/);
	});

	it('accounts for the safe-area inset the bar itself pads by', () => {
		const declaration = CSS.match(/--bottom-nav-height:([^;]+);/)?.[1] ?? '';

		expect(declaration).toContain('4rem');
		expect(declaration, 'a bare 4rem still leaves the bar taller than the gap left for it').toContain(
			'env(safe-area-inset-bottom)',
		);
	});

	it('is the single source of truth for the space the bar occupies', () => {
		// `.pb-bottom-nav` keeps scrollable content clear of the same bar. Two independent copies of
		// the expression is how the variable came to be missing in the first place.
		const padding = CSS.match(/\.pb-bottom-nav\s*\{\s*padding-bottom:([^;]+);/)?.[1] ?? '';

		expect(padding).toContain('var(--bottom-nav-height)');
	});
});
