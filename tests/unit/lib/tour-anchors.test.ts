import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getTourSteps } from '@/lib/tour-steps';

/**
 * Every tour step must point at an anchor the markup actually renders, and every anchor the markup
 * renders must be used by a step.
 *
 * `selectPresentSteps` drops a step whose anchor is missing, by design — a step highlighting
 * nothing is worse than no step. That safety net is also what makes this failure silent: rename a
 * nav item's `id` and the tour quietly loses a step, with every existing test still green. The
 * `data-tour` convention exists precisely so anchors are visibly load-bearing, and nothing was
 * enforcing it.
 *
 * The reverse direction matters too. Two `data-tour="help-guide"` attributes sat in the navigation
 * for a while with no step referencing them, reading to anyone editing that markup as though moving
 * them would break the tour.
 *
 * This reads the source rather than rendering, because the two navigations mount under different
 * breakpoints and jsdom has no layout — a render test would have to fake the very thing in question.
 */

const ROOT = process.cwd();

function source(...segments: string[]): string {
	return readFileSync(path.join(ROOT, ...segments), 'utf8');
}

/** `data-tour="literal"` occurrences. */
function literalAnchors(text: string): string[] {
	return [...text.matchAll(/data-tour="([^"]+)"/g)].map(match => match[1]);
}

/** `data-tour={`nav-${item.id}`}` expands via the `id: '...'` list in the same file. */
function navAnchors(text: string): string[] {
	if (!/data-tour=\{`nav-\$\{/.test(text)) {
		return [];
	}
	return [...text.matchAll(/\bid: '([a-z]+)'/g)].map(match => `nav-${match[1]}`);
}

const FILES = [
	['components', 'app', 'sidebar.tsx'],
	['components', 'app', 'bottom-nav.tsx'],
	['components', 'app', 'mobile-header.tsx'],
	['components', 'help', 'help-bot.tsx'],
];

const rendered = new Set(
	FILES.flatMap(segments => {
		const text = source(...segments);
		return [...literalAnchors(text), ...navAnchors(text)];
	}),
);

describe('tour anchors match the markup', () => {
	it('finds the anchors this test depends on, so a moved file fails loudly', () => {
		// Without this, a renamed component would empty `rendered` and the checks below would pass
		// by having nothing to compare against.
		expect(rendered.size).toBeGreaterThan(6);
		expect(rendered).toContain('nav-home');
		expect(rendered).toContain('mobile-menu');
	});

	it('every desktop step points at an anchor that exists', () => {
		for (const step of getTourSteps('desktop')) {
			expect(rendered, `desktop step "${step.title}" has no data-tour="${step.anchor}"`).toContain(step.anchor);
		}
	});

	it('every mobile step points at an anchor that exists', () => {
		for (const step of getTourSteps('mobile')) {
			expect(rendered, `mobile step "${step.title}" has no data-tour="${step.anchor}"`).toContain(step.anchor);
		}
	});

	it('leaves no anchor in the markup unused by any step', () => {
		const used = new Set([...getTourSteps('desktop'), ...getTourSteps('mobile')].map(step => step.anchor));

		// Navigation entries that no step points at are expected — the tour covers a chosen path
		// through the app, not every link. Only non-`nav-` anchors are claimed exclusively by it.
		const orphans = [...rendered].filter(anchor => !anchor.startsWith('nav-') && !used.has(anchor));

		expect(orphans, 'data-tour attributes that look load-bearing but no step uses').toEqual([]);
	});
});
