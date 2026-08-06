import { randomInt } from 'node:crypto';

// Excludes visually similar characters (0/O, 1/I/L) so codes survive being read aloud
// or copied by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

/** Server-only: needs node:crypto, so it must not reach a client bundle. */
export function generateInviteCode(): string {
	let code = '';
	for (let i = 0; i < CODE_LENGTH; i++) {
		code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
	}
	return code;
}
