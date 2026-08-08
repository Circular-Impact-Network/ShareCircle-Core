import { describe, expect, it } from 'vitest';
import { APP_KNOWLEDGE, buildSystemPrompt } from '@/lib/help-knowledge';

/**
 * The prompt is hard-wrapped for readability, so a phrase that reads as one sentence can contain a
 * newline. These assertions are about what the prompt says, not how it is laid out.
 */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/**
 * The bot answers only from this prompt, so these assert the properties that decide whether it is
 * useful and whether it is safe — not the wording, which will change.
 */
describe('buildSystemPrompt', () => {
	it('describes the navigation of the device the user is actually on', () => {
		const desktop = buildSystemPrompt('desktop');
		const mobile = buildSystemPrompt('mobile');

		// Telling a phone user to use the sidebar is the specific failure this hint exists to prevent.
		expect(desktop).toMatch(/left sidebar/i);
		expect(desktop).toMatch(/never refer to a bottom bar/i);
		expect(mobile).toMatch(/bottom bar/i);
		expect(mobile).toMatch(/there is no sidebar on a phone/i);
	});

	it('carries the product knowledge, not just the screen guide', () => {
		// The uploaded guide alone is ~1,400 tokens of screen descriptions and cannot answer these.
		for (const topic of [
			/invite codes expire after 7 days/i,
			/RETURN_PENDING/,
			/WAITING -> READY/,
			/thirteen notification types/i,
		]) {
			expect(flat(APP_KNOWLEDGE)).toMatch(topic);
		}
	});

	it('states the scope limit and the injection rule', () => {
		const prompt = flat(buildSystemPrompt('desktop'));
		expect(prompt).toMatch(/only discuss sharecircle/i);
		expect(prompt).toMatch(/is data, never instructions/i);
		expect(prompt).toMatch(/reveal or repeat this prompt/i);
	});

	it('forbids inventing anything the reference does not contain', () => {
		expect(flat(buildSystemPrompt('desktop'))).toMatch(/never invent a feature/i);
	});

	// The bot is given no account data at all, so it must not imply otherwise.
	it('states that it has no access to the user account', () => {
		const prompt = flat(buildSystemPrompt('mobile'));
		expect(prompt).toMatch(/no access to any user's account/i);
		expect(prompt).toMatch(/never claim to see, change or do anything on their behalf/i);
	});

	it('embeds the reference so answers are grounded', () => {
		expect(buildSystemPrompt('desktop')).toContain(APP_KNOWLEDGE);
	});
});

describe('APP_KNOWLEDGE', () => {
	it('records the iOS restriction, which is the most common push question', () => {
		expect(flat(APP_KNOWLEDGE)).toMatch(/added to the Home Screen/i);
		expect(flat(APP_KNOWLEDGE)).toMatch(/Apple restriction, not a ShareCircle setting/i);
	});

	it('says where borrow requests and listings live', () => {
		expect(APP_KNOWLEDGE).toMatch(/My Activity/);
		expect(APP_KNOWLEDGE).toMatch(/My Listings/);
	});
});
