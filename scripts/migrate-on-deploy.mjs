#!/usr/bin/env node
/**
 * Applies pending Prisma migrations during a production install.
 *
 * Why this exists in `postinstall` as well as `prestart`:
 *
 *   `prestart` only fires when the host launches the app with `npm start`. Hostinger's start
 *   command is configured in hPanel, not in this repo — if it is set to `next start` (or a PM2
 *   / Docker invocation) then npm lifecycle scripts are bypassed and migrations silently never
 *   run. There is no in-repo file that can override that setting, but every deploy must install
 *   dependencies, so `postinstall` is a path the host cannot skip.
 *
 *   The obvious alternative was Next.js's `instrumentation.ts` hook, which runs on server boot
 *   regardless of start command. It does not work here: this project builds with
 *   `next build --webpack`, and webpack refuses to bundle `node:child_process` for the edge
 *   runtime compilation of that file — including behind a dynamic import in a second module.
 *
 * Both paths are safe to run together. `migrate deploy` is a no-op when nothing is pending, and
 * Prisma takes a Postgres advisory lock, so concurrent instances cannot race.
 *
 * Guarded narrowly, because `postinstall` also runs on every developer's `npm install`:
 *
 *   - CI            — GitHub Actions' DIRECT_URL points at Supabase's direct endpoint
 *                     (db.<ref>.supabase.co:5432), which resolves to IPv6 only while runners are
 *                     IPv4-only. It fails with P1001 and would break every workflow.
 *   - VERCEL        — Vercel serves staging and manages that schema separately.
 *   - non-production NODE_ENV — a developer running `npm install` must never migrate a database
 *                     as a side effect. Use `npm run db:migrate:dev` explicitly.
 *
 * Failure is fatal on purpose: a deploy that cannot migrate should fail loudly rather than serve
 * traffic against a half-migrated schema.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const skipReason = process.env.CI
	? 'CI is set'
	: process.env.VERCEL
		? 'running on Vercel'
		: process.env.NODE_ENV !== 'production'
			? `NODE_ENV is ${process.env.NODE_ENV ?? 'unset'}, not production`
			: null;

if (skipReason) {
	console.log(`[migrate-on-deploy] skipped (${skipReason})`);
	process.exit(0);
}

if (!process.env.DIRECT_URL) {
	console.error(
		'[migrate-on-deploy] DIRECT_URL is not set. `prisma migrate deploy` needs a direct ' +
			'(non-pooled, DDL-capable) connection; the pgbouncer URL in DATABASE_URL cannot run DDL.',
	);
	process.exit(1);
}

console.log('[migrate-on-deploy] applying pending migrations…');

// Resolve the binary explicitly. npm puts node_modules/.bin on PATH when it runs a lifecycle
// script, but not when this file is invoked directly, and relying on that difference makes the
// script fail with ENOENT depending on how it was called.
const localBin = path.join(
	process.cwd(),
	'node_modules',
	'.bin',
	process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);
const prismaBin = existsSync(localBin) ? localBin : 'prisma';

const result = spawnSync(prismaBin, ['migrate', 'deploy'], {
	stdio: 'inherit',
	env: process.env,
	shell: process.platform === 'win32',
});

if (result.error) {
	console.error(`[migrate-on-deploy] could not run prisma: ${result.error.message}`);
	process.exit(1);
}

if (result.status !== 0) {
	console.error('[migrate-on-deploy] FAILED — refusing to finish a deploy on a half-migrated schema.');
	process.exit(result.status ?? 1);
}

console.log('[migrate-on-deploy] done.');
