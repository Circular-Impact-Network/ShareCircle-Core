import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

// Runtime uses DATABASE_URL — must be the Supabase Supavisor pooler (port 6543, ?pgbouncer=true)
// to avoid per-invocation connection storms on serverless. Migrations use DIRECT_URL.
// If/when Accelerate is added: `new PrismaClient().$extends(withAccelerate())` and point DATABASE_URL at the Accelerate edge.
export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
	});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}

export default prisma;
