import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Requirement (2026-08-05): "Add greyed-out 'Security deposit' field to the Create / Edit Item
 * Listing form", extending the original ask: "lock icon + 'Security deposit' + 'Not set yet'
 * muted + 'Coming soon' pill, whole row reduced opacity, no tap interaction, display-only (not a
 * form element)."
 *
 * This is a surface-parity test, and it exists because of how the row was missed the first time:
 * it was built on the item detail page only, and the e2e test was then written against that same
 * page — so a green suite reported a requirement that had not been met. Enumerating the surfaces
 * here is what makes a missing one fail.
 *
 * Source assertions rather than render assertions: in add-item-modal the row lives inside the
 * `editing` state, only reachable after a file upload, which happy-dom cannot drive (see the note
 * in add-item-modal.test.tsx). The live interaction is covered in
 * tests/e2e/coming-soon-and-install.spec.ts.
 */
const SURFACES = [
	['item detail page', 'components/pages/item-detail-page.tsx'],
	['create item form', 'components/modals/add-item-modal.tsx'],
	['edit item form', 'components/modals/edit-item-modal.tsx'],
] as const;

/** The whole `<div …data-testid="security-deposit-row"> … </div>` element, or '' if absent. */
function readRow(relativePath: string): string {
	const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
	// Attributes may precede data-testid on the opening tag, so match from the tag start.
	return source.match(/<div\s[^>]*?data-testid="security-deposit-row"[\s\S]*?<\/div>/)?.[0] ?? '';
}

describe('security deposit signpost', () => {
	describe.each(SURFACES)('%s', (_label, path) => {
		const source = readFileSync(resolve(process.cwd(), path), 'utf8');
		const row = readRow(path);

		it('renders the row', () => {
			expect(row, `no security-deposit-row found in ${path}`).not.toBe('');
		});

		it('shows the label and the not-set state', () => {
			expect(row).toContain('Security deposit');
			expect(row).toContain('Not set yet');
		});

		it('shows a lock icon and a Coming soon pill', () => {
			expect(row).toContain('<Lock');
			expect(row).toContain('<ComingSoonPill');
			expect(source).toContain("from '@/components/ui/coming-soon-pill'");
		});

		it('is visually muted', () => {
			expect(row).toMatch(/opacity-60/);
			expect(row).toMatch(/text-muted-foreground/);
		});

		it('is display-only — not a form element and not interactive', () => {
			expect(row).toContain('aria-disabled="true"');
			// No input to type in, no control to tap, and no handler. A form element here would
			// imply the owner can set a value that does not exist yet.
			expect(row).not.toMatch(/<(input|button|Input|Button|Switch|Checkbox)\b/);
			expect(row).not.toMatch(/onClick|onChange|onPress/);
			// No tooltip and no modal, per the requirement.
			expect(row).not.toMatch(/Tooltip|Dialog/);
		});
	});

	it('is absent from the lightweight preview modal, which shows no value fields', () => {
		// Considered and deliberately excluded: item-details-modal renders name, categories,
		// tags, owner and date only — no weight, price or value context for a deposit to sit in.
		const preview = readFileSync(resolve(process.cwd(), 'components/modals/item-details-modal.tsx'), 'utf8');
		expect(preview).not.toContain('security-deposit-row');
		expect(preview).not.toContain('estimatedNewPriceUsd');
	});

	it('covers every item surface that displays value fields', () => {
		// Guard against a fourth surface appearing without the row. If a component starts
		// showing price or weight, it needs the deposit signpost too.
		const valueSurfaces = [
			'components/pages/item-detail-page.tsx',
			'components/modals/add-item-modal.tsx',
			'components/modals/edit-item-modal.tsx',
		];
		for (const path of valueSurfaces) {
			const source = readFileSync(resolve(process.cwd(), path), 'utf8');
			expect(source).toContain('estimatedNewPriceUsd');
			expect(source, `${path} shows value fields but no deposit row`).toContain('security-deposit-row');
		}
	});
});
