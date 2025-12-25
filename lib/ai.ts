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

/**
 * Analyze an item image using Google Gemini Vision
 * @param imageUrl - The URL of the image to analyze
 * @returns Extracted item details: name, description, categories, and tags
 */
export async function analyzeImage(imageUrl: string): Promise<ItemAnalysis> {
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
						text: `Analyze this item image for a sharing/lending app where people share items within their communities. Extract:
- A clear, concise name (2-5 words)
- A helpful description mentioning condition and key features (2-3 sentences)
- Relevant broad categories (e.g., "Tools", "Outdoor", "Kitchen", "Sports", "Electronics", etc.)
- Specific searchable tags that would help others find this item

Be practical and focus on what makes this item useful for borrowing/sharing.`,
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
