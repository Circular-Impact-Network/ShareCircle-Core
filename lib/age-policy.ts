/**
 * One definition of the minimum-age rule.
 *
 * It was previously implemented in `app/signup/page.tsx` and `app/api/user/complete-profile`,
 * but *not* in `app/api/auth/signup` — whose schema accepted `dateOfBirth` as
 * `z.string().trim().max(32).optional()`. Posting `{"dateOfBirth":"2020-01-01"}` therefore created
 * a five-year-old's account that sailed through the profile-completion gate, and a value like
 * `"tomorrow"` produced `new Date("tomorrow")` → Invalid Date → a Prisma throw surfaced as a
 * generic 500.
 *
 * The comment in complete-profile even claimed it "mirrors signup". It did not. Same failure as
 * the password rules: a policy restated per call site drifts, and the gap shows up wherever
 * somebody forgot.
 */

export const MINIMUM_AGE_YEARS = 13;

export const MINIMUM_AGE_MESSAGE = `You must be at least ${MINIMUM_AGE_YEARS} years old.`;

/** Parses a date-of-birth string, returning null for anything unusable. */
export function parseDateOfBirth(raw: string): Date | null {
	const parsed = new Date(raw);
	if (Number.isNaN(parsed.getTime())) return null;
	// A birth date in the future is never valid and would otherwise pass the age comparison.
	if (parsed.getTime() > Date.now()) return null;
	return parsed;
}

/** True when someone born on `dob` has reached the minimum age today. */
export function isOldEnough(dob: Date): boolean {
	const cutoff = new Date();
	cutoff.setFullYear(cutoff.getFullYear() - MINIMUM_AGE_YEARS);
	return dob <= cutoff;
}

/**
 * Validates a raw date-of-birth string in one step. Returns the parsed date, or an error message
 * suitable for returning to the client.
 */
export function validateDateOfBirth(raw: string): { date: Date } | { error: string } {
	const parsed = parseDateOfBirth(raw);
	if (!parsed) return { error: 'Invalid date of birth' };
	if (!isOldEnough(parsed)) return { error: MINIMUM_AGE_MESSAGE };
	return { date: parsed };
}
