import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

// ============ GEMINI VISION (Image Analysis) ============
// Uses GEMINI_API_KEY from env (auto-picked by @ai-sdk/google)

const itemAnalysisSchema = z.object({
	name: z.string().describe('A short, clear name for the item (2-5 words)'),
	description: z.string().describe('2-3 sentence description of the item, its condition, and key features'),
	categories: z
		.array(z.string())
		.describe('2-4 broad categories this item belongs to (e.g., "Tools", "Outdoor", "Kitchen")'),
	tags: z.array(z.string()).describe('5-10 specific searchable tags for the item'),
});

export type ItemAnalysis = z.infer<typeof itemAnalysisSchema>;

// ============ ITEM DETECTION SCHEMA (Option 2) ============

const itemDetectionSchema = z.object({
	items: z
		.array(
			z.object({
				name: z.string().describe('Short name of the detected item (2-5 words)'),
				description: z.string().optional().describe('Brief description of the item'),
				category: z.string().describe('Primary category (e.g., "Clothing", "Electronics", "Tools")'),
				confidence: z.enum(['high', 'medium', 'low']).optional().describe('Confidence level of detection'),
			}),
		)
		.describe('Array of all detected items in the image'),
});

export type ItemDetection = z.infer<typeof itemDetectionSchema>;

// ============ ITEM VALIDATION SCHEMA ============

const itemValidationSchema = z.object({
	isValid: z.boolean().describe('Whether the described item exists in the photo'),
	matchedItem: z.string().optional().describe('The name of the item that matches the description, if found'),
	confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level of the match'),
	reason: z.string().describe('Brief explanation of why the item was or was not found'),
	detectedItems: z.array(z.string()).describe('List of all items detected in the image for reference'),
});

export type ItemValidation = z.infer<typeof itemValidationSchema>;

/**
 * Validate whether a user-described item exists in the image
 * This should be called before analysis when a user provides a hint/description
 * @param imageUrl - The URL of the image to validate against
 * @param userDescription - The user's description/hint of what the item is
 * @returns Validation result indicating if the described item exists in the photo
 */
export async function validateItemInImage(imageUrl: string, userDescription: string): Promise<ItemValidation> {
	const result = await generateObject({
		model: google('gemini-2.5-flash'),
		schema: itemValidationSchema,
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'image', image: imageUrl },
					{
						type: 'text',
						text: `The user says this image contains: "${userDescription}"

Your task is to verify whether this item actually exists in the image.

IMPORTANT INSTRUCTIONS:
1. First, identify ALL items visible in the image
2. Then, check if any item matches or closely relates to the user's description
3. Be generous with matching - accept:
   - Exact matches (user says "blue dress", image has a blue dress)
   - Close matches (user says "summer dress", image has a floral dress)
   - Category matches (user says "dress", image has any type of dress)
   - Partial matches (user says "red bag", image has a maroon purse)
4. Only mark as invalid if NO item in the image is even remotely related to the description

Return:
- isValid: true if ANY item in the image could reasonably match the description
- matchedItem: The specific item that matches (if valid)
- confidence: How confident you are in the match
- reason: Brief explanation
- detectedItems: List all items you can see in the image

Be lenient - it's better to allow a slightly mismatched description than to reject a valid item.`,
					},
				],
			},
		],
	});

	return result.object;
}

/** Result of validating listing text against multiple images (e.g. main + supporting). */
export interface ValidateListingFailure {
	imageIndex: number;
	imageLabel: string;
	reason: string;
	detectedItems?: string[];
}

export interface ValidateListingResult {
	valid: boolean;
	failures: ValidateListingFailure[];
}

/** Listing fields used for strict validation (name must match the image). */
export interface ListingFields {
	name: string;
	description?: string | null;
	categories?: string[];
	tags?: string[];
}

/**
 * Strict validation: check that the listing NAME matches the primary subject of the image.
 * Used on create/update to block mismatches (e.g. name "Red shoes" but image shows tennis bags).
 */
async function validateListingMatchInImage(imageUrl: string, listing: ListingFields): Promise<ItemValidation> {
	const name = listing.name.trim();
	const desc = listing.description?.trim() || '';
	const cats = (listing.categories ?? []).join(', ');
	const tagsList = (listing.tags ?? []).join(', ');

	const result = await generateObject({
		model: google('gemini-2.5-flash'),
		schema: itemValidationSchema,
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'image', image: imageUrl },
					{
						type: 'text',
						text: `An item listing has been entered with the following:

NAME (required to match): "${name}"
DESCRIPTION: ${desc || '(none)'}
CATEGORIES: ${cats || '(none)'}
TAGS: ${tagsList || '(none)'}

Your task: Decide whether the image shows THE SAME item as described by this listing.

STRICT RULES:
1. The NAME is the primary identifier. The main subject of the image must match what the NAME describes.
2. If the name describes something clearly different from what is in the image (e.g. name says "Red shoes" but the image shows tennis bags, or name says "Drill" but image shows a book), return isValid: false.
3. Description/categories/tags can support the match but cannot override a name mismatch. If the name does not match the image, return isValid: false.
4. Only return isValid: true if the image shows an item that matches the NAME (and description/tags are consistent).

Return:
- isValid: true only if the image's primary subject matches the listing NAME
- reason: brief explanation (e.g. "Name describes shoes but image shows tennis bags")
- detectedItems: list of main items you see in the image

Be strict: reject clear mismatches between the listing name and the image content.`,
					},
				],
			},
		],
	});

	return result.object;
}

/**
 * Validate that listing (name, description, categories, tags) matches all given images.
 * Uses strict name-based check: the NAME must match the primary subject of each image.
 * @param imageEntries - Array of { url, label } for main image and supporting media
 * @param listing - Listing fields (name required; description, categories, tags optional)
 * @returns Result with valid: false and failures list if any image does not match
 */
export async function validateListingAgainstImages(
	imageEntries: { url: string; label: string }[],
	listing: ListingFields,
): Promise<ValidateListingResult> {
	const failures: ValidateListingFailure[] = [];

	for (let i = 0; i < imageEntries.length; i++) {
		const { url, label } = imageEntries[i];
		try {
			const validation = await validateListingMatchInImage(url, listing);
			if (!validation.isValid) {
				failures.push({
					imageIndex: i,
					imageLabel: label,
					reason: validation.reason,
					detectedItems: validation.detectedItems,
				});
			}
		} catch (err) {
			failures.push({
				imageIndex: i,
				imageLabel: label,
				reason:
					err instanceof Error
						? err.message
						: 'Could not validate this media (may be video or unsupported format).',
			});
		}
	}

	return {
		valid: failures.length === 0,
		failures,
	};
}

/**
 * Analyze an item image using Google Gemini Vision
 * @param imageUrl - The URL of the image to analyze
 * @param options - Optional parameters for focused analysis
 * @param options.selectedItem - When provided, focus analysis on this specific item
 * @param options.userHint - When provided, use this user-provided hint to guide analysis
 * @returns Extracted item details: name, description, categories, and tags
 */
export async function analyzeImage(
	imageUrl: string,
	options?: { selectedItem?: string; userHint?: string },
): Promise<ItemAnalysis> {
	let promptText = `Analyze this item image for a sharing/lending app where people share items within their communities.

IMPORTANT INSTRUCTIONS:
- Look at ALL items in the image, especially clothing, apparel, dresses, and garments
- If multiple items are present, identify the PRIMARY or MAIN item that the user wants to share
- Pay special attention to clothing items (dresses, shirts, pants, jackets, shoes, accessories, etc.)
- Do NOT ignore clothing items - they are often the main focus
- If clothing is present, prioritize it unless another item is clearly the main subject

Extract:
- A clear, concise name (2-5 words) for the PRIMARY item
- A helpful description mentioning condition and key features (2-3 sentences)
- Relevant broad categories (e.g., "Clothing", "Apparel", "Tools", "Outdoor", "Kitchen", "Sports", "Electronics", etc.)
- Specific searchable tags that would help others find this item

Be practical and focus on what makes this item useful for borrowing/sharing.`;

	// If user selected a specific item, focus on that
	if (options?.selectedItem) {
		promptText = `Analyze this image and focus specifically on the item: "${options.selectedItem}"

This is the item the user wants to share. Extract details ONLY for this specific item:
- A clear, concise name (2-5 words)
- A helpful description mentioning condition and key features (2-3 sentences)
- Relevant broad categories
- Specific searchable tags

Ignore other items in the image and focus entirely on "${options.selectedItem}".`;
	}

	// If user provided a hint, incorporate it
	if (options?.userHint) {
		promptText = `Analyze this item image for a sharing/lending app. The user describes it as: "${options.userHint}"

Use this description to help identify and analyze the correct item. Extract:
- A clear, concise name (2-5 words) that matches the user's description
- A helpful description mentioning condition and key features (2-3 sentences)
- Relevant broad categories
- Specific searchable tags

Focus on items that match "${options.userHint}" and prioritize accuracy based on the user's description.`;
	}

	const result = await generateObject({
		model: google('gemini-2.5-flash'),
		schema: itemAnalysisSchema,
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'image', image: imageUrl },
					{
						type: 'text',
						text: promptText,
					},
				],
			},
		],
	});

	return result.object;
}

/**
 * Detect all items in an image using Google Gemini Vision
 * This is used for Option 2 flow where we first detect all items, then let user select
 * @param imageUrl - The URL of the image to analyze
 * @returns Array of detected items with names, categories, and confidence levels
 */
export async function detectItems(imageUrl: string): Promise<ItemDetection> {
	const result = await generateObject({
		model: google('gemini-2.5-flash'),
		schema: itemDetectionSchema,
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'image', image: imageUrl },
					{
						type: 'text',
						text: `Analyze this image and identify items that could realistically be shared or lent to someone in a community sharing app.

ONLY include items that are portable and ownable — things that can be physically handed to another person. Examples: clothing, accessories, tools, electronics, appliances, sports equipment, bags, books, toys, musical instruments, camping gear, moveable furniture, kitchen gadgets.

DO NOT include:
- Architectural/structural elements: walls, floors, ceilings, staircases, pillars, columns, built-in doors, windows, doorframes
- Outdoor/natural fixtures: trees, plants, grass, hedges, rocks, soil, sky, water
- Permanent infrastructure: pipes, electrical panels, radiators, built-in shelving, fixed light fixtures, HVAC units, built-in cabinets
- Abstract concepts: rooms, spaces, views, lighting conditions, shadows, surfaces, backgrounds
- People or animals

Return an array of shareable items found with:
- name: Short, clear name (2-5 words)
- description: Brief description if helpful
- category: Primary category (e.g., "Clothing", "Tools", "Electronics", "Sports", "Books", "Appliances")
- confidence: How confident you are about this detection

If no shareable items are visible, return an empty array.`,
					},
				],
			},
		],
	});

	return result.object;
}

// ============ VOYAGE MULTIMODAL EMBEDDINGS ============
// Uses VOYAGE_API_KEY from env

import { VoyageAIClient } from 'voyageai';

// Initialize Voyage AI client
const voyageClient = new VoyageAIClient({
	apiKey: process.env.VOYAGE_API_KEY,
});

/**
 * Build an enriched text string from item metadata for embedding generation.
 * Combines name, description, categories, and tags into a structured string
 * that captures the full semantic meaning of the item.
 */
export function buildEnrichedText(metadata: {
	name: string;
	description?: string | null;
	categories?: string[];
	tags?: string[];
}): string {
	return [
		`Name: ${metadata.name}`,
		metadata.description ? `Description: ${metadata.description}` : '',
		metadata.categories?.length ? `Categories: ${metadata.categories.join(', ')}` : '',
		metadata.tags?.length ? `Tags: ${metadata.tags.join(', ')}` : '',
	]
		.filter(Boolean)
		.join('. ');
}

/**
 * Generate a document embedding for an item (image + enriched text metadata).
 * Uses input_type: 'document' to optimize for retrieval as a stored document.
 * This should be used when storing item embeddings.
 * @param imageUrl - The URL of the item image
 * @param text - Enriched text from buildEnrichedText()
 * @returns 1024-dimensional embedding vector
 */
export async function generateDocumentEmbedding(imageUrl: string, text: string): Promise<number[]> {
	try {
		const result = await voyageClient.multimodalEmbed({
			inputs: [
				{
					content: [
						{ type: 'image_url', imageUrl: imageUrl },
						{ type: 'text', text },
					],
				},
			],
			model: 'voyage-multimodal-3',
			inputType: 'document',
		});

		if (!result.data || result.data.length === 0 || !result.data[0].embedding) {
			throw new Error('No embedding data returned from Voyage AI');
		}

		return result.data[0].embedding;
	} catch (error) {
		console.error('Voyage AI document embedding error:', error);
		throw new Error(`Voyage AI embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Generate an embedding for an image using Voyage AI multimodal model
 * @param imageUrl - The URL of the image to embed
 * @returns 1024-dimensional embedding vector
 * @deprecated Use generateDocumentEmbedding for item storage instead
 */
export async function generateImageEmbedding(imageUrl: string): Promise<number[]> {
	try {
		const result = await voyageClient.multimodalEmbed({
			inputs: [
				{
					content: [{ type: 'image_url', imageUrl: imageUrl }],
				},
			],
			model: 'voyage-multimodal-3',
		});

		if (!result.data || result.data.length === 0 || !result.data[0].embedding) {
			throw new Error('No embedding data returned from Voyage AI');
		}

		return result.data[0].embedding;
	} catch (error) {
		console.error('Voyage AI image embedding error:', error);
		throw new Error(`Voyage AI embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Generate an embedding for text using Voyage AI multimodal model.
 * Uses input_type: 'query' to optimize for search queries.
 * @param text - The text to embed
 * @returns 1024-dimensional embedding vector
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
	try {
		const result = await voyageClient.multimodalEmbed({
			inputs: [
				{
					content: [{ type: 'text', text }],
				},
			],
			model: 'voyage-multimodal-3',
			inputType: 'query',
		});

		if (!result.data || result.data.length === 0 || !result.data[0].embedding) {
			throw new Error('No embedding data returned from Voyage AI');
		}

		return result.data[0].embedding;
	} catch (error) {
		console.error('Voyage AI text embedding error:', error);
		throw new Error(`Voyage AI embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Generate a combined embedding for image + text search query.
 * Uses input_type: 'query' to optimize for search.
 * Useful for queries like "similar to this but in blue"
 * @param imageUrl - The URL of the image
 * @param text - The text to combine with the image
 * @returns 1024-dimensional embedding vector
 */
export async function generateMultimodalEmbedding(imageUrl: string, text: string): Promise<number[]> {
	try {
		const result = await voyageClient.multimodalEmbed({
			inputs: [
				{
					content: [
						{ type: 'image_url', imageUrl: imageUrl },
						{ type: 'text', text },
					],
				},
			],
			model: 'voyage-multimodal-3',
			inputType: 'query',
		});

		if (!result.data || result.data.length === 0 || !result.data[0].embedding) {
			throw new Error('No embedding data returned from Voyage AI');
		}

		return result.data[0].embedding;
	} catch (error) {
		console.error('Voyage AI multimodal embedding error:', error);
		throw new Error(`Voyage AI embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
