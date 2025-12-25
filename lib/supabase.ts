import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server-side Supabase admin client (uses service role key, bypasses RLS)
// This should ONLY be used in server-side API routes
// Lazy initialization to avoid errors if service role key is not set
let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
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
export async function uploadImage(file: File, bucket: string = 'avatars', userId: string): Promise<string> {
	const fileExt = file.name.split('.').pop();
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

/**
 * Get a signed URL for a private image
 * Uses admin client (service role key) for server-side operations
 * @param filePath - The path of the file in storage
 * @param bucket - The storage bucket name
 * @param expiresIn - Expiration time in seconds (default: 1 year)
 * @returns The signed URL
 */
export async function getSignedUrl(
	filePath: string,
	bucket: string = 'avatars',
	expiresIn: number = 31536000, // 1 year in seconds
): Promise<string> {
	const admin = getSupabaseAdmin();
	const { data, error } = await admin.storage.from(bucket).createSignedUrl(filePath, expiresIn);

	if (error) {
		throw new Error(`Failed to generate signed URL: ${error.message}`);
	}

	return data.signedUrl;
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
