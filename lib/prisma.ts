import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
	});

// Always cache Prisma Client in global to prevent multiple instances in serverless environments
// This is critical for Vercel and other serverless platforms where each function invocation
// could create a new Prisma Client instance, exhausting the database connection pool
if (!globalForPrisma.prisma) {
	globalForPrisma.prisma = prisma;
}

export default prisma;
