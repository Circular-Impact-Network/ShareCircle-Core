import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-side Supabase admin client (uses service role key, bypasses RLS)
// This should ONLY be used in server-side API routes
// Lazy initialization to avoid errors if service role key is not set
let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
	const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl) {
		throw new Error(
			'SUPABASE_URL is required for server-side operations. ' +
				'Please add it to your .env.local file. You can find it in your Supabase Dashboard under Settings → API → Project URL.',
		);
	}

	if (!supabaseServiceRoleKey) {
		throw new Error(
			'SUPABASE_SERVICE_ROLE_KEY is required for server-side operations. ' +
				'Please add it to your .env.local file. You can find it in your Supabase Dashboard under Settings → API → Service Role Key.',
		);
	}

	if (!supabaseAdminInstance) {
		supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false,
			},
		});
	}

	return supabaseAdminInstance;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
	get(_target, prop) {
		return getSupabaseAdmin()[prop as keyof SupabaseClient];
	},
});

/**
 * Upload an image to Supabase storage (PRIVATE bucket with RLS)
 * Uses admin client (service role key) to bypass RLS for server-side uploads
 * @param file - The file to upload
 * @param bucket - The storage bucket name (default: 'avatars')
 * @param userId - The user ID to organize files and enforce RLS
 * @returns The path of the uploaded file (used to generate signed URLs)
 */
const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/heic': 'heic',
	'image/heif': 'heif',
	'video/mp4': 'mp4',
	'video/webm': 'webm',
	'video/quicktime': 'mov',
};

export async function uploadImage(file: File, bucket: string = 'avatars', userId: string): Promise<string> {
	const fileExt = MIME_TO_EXT[file.type] ?? 'bin';
	const fileName = `${userId}/${Date.now()}.${fileExt}`;

	const admin = getSupabaseAdmin();
	const { data, error } = await admin.storage.from(bucket).upload(fileName, file, {
		cacheControl: '3600',
		upsert: true,
	});

	if (error) {
		throw new Error(`Upload failed: ${error.message}`);
	}

	// Return the file path instead of public URL
	return data.path;
}

// Module-level URL cache keyed by "bucket:filePath".
// On Vercel serverless each instance has its own cache, but this still eliminates
// repeated calls within a single request (N+1 on item list pages).
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Get a signed URL for a private image.
 * URLs are cached for (expiresIn - 300) seconds to reduce Supabase Storage API calls.
 * Default expiry is 1 hour; callers should refresh on receiving a 403.
 */
export async function getSignedUrl(
	filePath: string,
	bucket: string = 'avatars',
	expiresIn: number = 3600, // 1 hour
): Promise<string> {
	const cacheKey = `${bucket}:${filePath}`;
	const cached = signedUrlCache.get(cacheKey);
	if (cached && Date.now() < cached.expiresAt) {
		return cached.url;
	}

	const admin = getSupabaseAdmin();
	const { data, error } = await admin.storage.from(bucket).createSignedUrl(filePath, expiresIn);

	if (error) {
		throw new Error(`Failed to generate signed URL: ${error.message}`);
	}

	// Cache with a 5-minute buffer before actual expiry
	signedUrlCache.set(cacheKey, { url: data.signedUrl, expiresAt: Date.now() + (expiresIn - 300) * 1000 });
	return data.signedUrl;
}

/**
 * Batch-generate signed URLs for many paths within a single bucket.
 * One Supabase HTTP request per bucket instead of one per path.
 * Returns a Map<path, url> for easy lookup. Cached paths are returned without re-signing.
 */
export async function getSignedUrls(
	filePaths: string[],
	bucket: string = 'avatars',
	expiresIn: number = 3600,
): Promise<Map<string, string>> {
	const result = new Map<string, string>();
	if (filePaths.length === 0) return result;

	const uniquePaths = Array.from(new Set(filePaths));
	const pathsToFetch: string[] = [];

	for (const filePath of uniquePaths) {
		const cacheKey = `${bucket}:${filePath}`;
		const cached = signedUrlCache.get(cacheKey);
		if (cached && Date.now() < cached.expiresAt) {
			result.set(filePath, cached.url);
		} else {
			pathsToFetch.push(filePath);
		}
	}

	if (pathsToFetch.length === 0) return result;

	const admin = getSupabaseAdmin();
	const { data, error } = await admin.storage.from(bucket).createSignedUrls(pathsToFetch, expiresIn);
	if (error || !data) {
		throw new Error(`Failed to generate signed URLs (batch): ${error?.message ?? 'unknown error'}`);
	}

	for (const row of data) {
		if (!row.signedUrl || !row.path) continue;
		signedUrlCache.set(`${bucket}:${row.path}`, {
			url: row.signedUrl,
			expiresAt: Date.now() + (expiresIn - 300) * 1000,
		});
		result.set(row.path, row.signedUrl);
	}
	return result;
}

/**
 * Delete an image from Supabase storage
 * Uses admin client (service role key) for server-side operations
 * @param filePath - The path of the file to delete
 * @param bucket - The storage bucket name
 */
export async function deleteImage(filePath: string, bucket: string = 'avatars'): Promise<void> {
	const admin = getSupabaseAdmin();
	const { error } = await admin.storage.from(bucket).remove([filePath]);

	if (error) {
		throw new Error(`Delete failed: ${error.message}`);
	}
}
