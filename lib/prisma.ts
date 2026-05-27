import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

// Runtime uses DATABASE_URL — must be the Supabase Supavisor pooler (port 6543, ?pgbouncer=true)
// to avoid per-invocation connection storms on serverless. Migrations use DIRECT_URL.
// If/when Accelerate is added: `new PrismaClient().$extends(withAccelerate())` and point DATABASE_URL at the Accelerate edge.

// Default Prisma connection_limit is num_physical_cpus * 2 + 1 (≈5 on CI runners).
// Under fully-parallel e2e load, that exhausts the pool and surfaces as P2024 timeouts.
// Bump defaults unless the URL already pins them explicitly.
function getDatabaseUrl(): string | undefined {
	const raw = process.env.DATABASE_URL;
	if (!raw) return undefined;
	try {
		const url = new URL(raw);
		if (!url.searchParams.has('connection_limit')) {
			url.searchParams.set('connection_limit', '25');
		}
		if (!url.searchParams.has('pool_timeout')) {
			url.searchParams.set('pool_timeout', '20');
		}
		return url.toString();
	} catch {
		return raw;
	}
}

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
		datasourceUrl: getDatabaseUrl(),
		// Multi-step transactions (e.g. send-message) blow the 5s default under contention
		// and surface as P2028. 20s leaves headroom without masking real deadlocks.
		transactionOptions: {
			maxWait: 10000,
			timeout: 20000,
		},
	});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}

export default prisma;
