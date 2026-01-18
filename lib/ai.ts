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
						text: `Analyze this image and identify ALL items present, especially clothing, apparel, dresses, and garments.

CRITICAL INSTRUCTIONS:
- Identify EVERY item in the image, including clothing, accessories, and apparel
- Pay special attention to clothing items (dresses, shirts, pants, jackets, shoes, bags, jewelry, etc.)
- Do NOT ignore or skip clothing items - they are often the main focus
- List items in order of prominence/size (most prominent first)
- Include items even if they are partially visible or in the background
- For clothing items, note the type (dress, shirt, etc.) and any distinguishing features

Return an array of all detected items with:
- name: Short, clear name (2-5 words)
- description: Brief description if helpful
- category: Primary category (prioritize "Clothing" or "Apparel" for garments)
- confidence: How confident you are about this detection

Focus on being comprehensive - it's better to include more items than to miss important ones.`,
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
 * Generate an embedding for an image using Voyage AI multimodal model
 * @param imageUrl - The URL of the image to embed
 * @returns 1024-dimensional embedding vector
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
 * Generate an embedding for text using Voyage AI multimodal model
 * Text embeddings are in the same vector space as images!
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
 * Generate a combined embedding for image + text using Voyage AI multimodal model
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
