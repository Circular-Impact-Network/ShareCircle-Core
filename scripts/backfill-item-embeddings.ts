import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { generateDocumentEmbedding, buildEnrichedText } from '../lib/ai';
import { getSignedUrl } from '../lib/supabase';

type ItemRow = {
	id: string;
	image_path: string;
	name: string;
	description: string | null;
	categories: string[];
	tags: string[];
};

const batchSize = Number(process.env.BACKFILL_BATCH_SIZE ?? 5);
const concurrency = Number(process.env.BACKFILL_CONCURRENCY ?? 1);
const maxItems = Number(process.env.BACKFILL_MAX ?? 0);
// Set to 'true' to only process items without embeddings; default processes ALL items
const nullOnly = process.env.BACKFILL_NULL_ONLY === 'true';
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
let warnedAboutPublicUrl = false;

async function resolveImageUrl(imagePath: string): Promise<string> {
	if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
		return getSignedUrl(imagePath, 'items');
	}

	if (!supabaseUrl) {
		throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is required to resolve image URLs.');
	}

	if (!warnedAboutPublicUrl) {
		console.warn(
			'SUPABASE_SERVICE_ROLE_KEY not set; using public storage URLs. Ensure the items bucket is public.',
		);
		warnedAboutPublicUrl = true;
	}

	return `${supabaseUrl}/storage/v1/object/public/items/${imagePath}`;
}

async function processItem(item: ItemRow): Promise<void> {
	try {
		const imageUrl = await resolveImageUrl(item.image_path);
		const enrichedText = buildEnrichedText({
			name: item.name,
			description: item.description,
			categories: item.categories,
			tags: item.tags,
		});
		const embedding = await generateDocumentEmbedding(imageUrl, enrichedText);
		const embeddingVector = Prisma.raw(`'[${embedding.join(',')}]'::vector`);
		await prisma.$executeRaw`
			UPDATE items SET embedding = ${embeddingVector}
			WHERE id = ${item.id}
		`;
		console.log(`Backfilled multimodal embedding for item ${item.id} ("${item.name}")`);
	} catch (error) {
		console.error(`Failed to backfill item ${item.id} ("${item.name}"):`, error);
	}
}

async function runWithConcurrency(items: ItemRow[]): Promise<void> {
	let index = 0;

	const workers = Array.from({ length: concurrency }).map(async () => {
		while (index < items.length) {
			const current = items[index];
			index += 1;
			await processItem(current);
		}
	});

	await Promise.all(workers);
}

async function main(): Promise<void> {
	await prisma.$connect();

	if (!Number.isFinite(batchSize) || batchSize <= 0) {
		throw new Error('BACKFILL_BATCH_SIZE must be a positive number.');
	}
	if (!Number.isFinite(concurrency) || concurrency <= 0) {
		throw new Error('BACKFILL_CONCURRENCY must be a positive number.');
	}

	const whereClause = nullOnly ? Prisma.sql`WHERE embedding IS NULL AND image_path IS NOT NULL` : Prisma.sql`WHERE image_path IS NOT NULL`;
	const modeLabel = nullOnly ? 'null-only' : 'all items (regenerating)';
	console.log(`Backfill mode: ${modeLabel}`);
	console.log(`Batch size: ${batchSize}, Concurrency: ${concurrency}, Max: ${maxItems || 'unlimited'}`);

	let processed = 0;
	let offset = 0;

	while (true) {
		const items = await prisma.$queryRaw<ItemRow[]>`
			SELECT id, image_path, name, description, categories, tags
			FROM items
			${whereClause}
			ORDER BY created_at ASC
			LIMIT ${batchSize}
			OFFSET ${offset}
		`;

		if (items.length === 0) {
			break;
		}

		await runWithConcurrency(items);
		processed += items.length;
		offset += items.length;

		console.log(`Progress: ${processed} items processed so far...`);

		if (maxItems > 0 && processed >= maxItems) {
			break;
		}
	}

	console.log(`Backfill completed. Items processed: ${processed}`);
}

main()
	.catch(error => {
		console.error('Backfill failed:', error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
