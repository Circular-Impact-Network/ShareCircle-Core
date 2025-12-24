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

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/multimodalembeddings';

interface VoyageEmbeddingResponse {
	object: string;
	data: Array<{
		object: string;
		embedding: number[];
		index: number;
	}>;
	model: string;
	usage: {
		total_tokens: number;
	};
}

/**
 * Generate an embedding for an image using Voyage AI multimodal model
 * @param imageUrl - The URL of the image to embed
 * @returns 1024-dimensional embedding vector
 */
export async function generateImageEmbedding(imageUrl: string): Promise<number[]> {
	const response = await fetch(VOYAGE_API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: 'voyage-multimodal-3',
			inputs: [[{ type: 'image_url', image_url: imageUrl }]],
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Voyage AI embedding failed: ${response.status} - ${errorText}`);
	}

	const data: VoyageEmbeddingResponse = await response.json();
	return data.data[0].embedding; // 1024-dimensional vector
}

/**
 * Generate an embedding for text using Voyage AI multimodal model
 * Text embeddings are in the same vector space as images!
 * @param text - The text to embed
 * @returns 1024-dimensional embedding vector
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
	const response = await fetch(VOYAGE_API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: 'voyage-multimodal-3',
			inputs: [[{ type: 'text', text }]],
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Voyage AI embedding failed: ${response.status} - ${errorText}`);
	}

	const data: VoyageEmbeddingResponse = await response.json();
	return data.data[0].embedding; // 1024-dimensional vector (same space as images!)
}

/**
 * Generate a combined embedding for image + text using Voyage AI multimodal model
 * Useful for queries like "similar to this but in blue"
 * @param imageUrl - The URL of the image
 * @param text - The text to combine with the image
 * @returns 1024-dimensional embedding vector
 */
export async function generateMultimodalEmbedding(imageUrl: string, text: string): Promise<number[]> {
	const response = await fetch(VOYAGE_API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: 'voyage-multimodal-3',
			inputs: [
				[
					{ type: 'image_url', image_url: imageUrl },
					{ type: 'text', text },
				],
			],
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Voyage AI embedding failed: ${response.status} - ${errorText}`);
	}

	const data: VoyageEmbeddingResponse = await response.json();
	return data.data[0].embedding;
}
