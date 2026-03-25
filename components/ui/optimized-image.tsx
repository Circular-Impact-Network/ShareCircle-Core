import type React from 'react';
import Image, { type ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

/**
 * OptimizedImage component with default Next.js Image optimizations
 *
 * Features:
 * - Automatic lazy loading (can be overridden with priority prop)
 * - Responsive images with srcset
 * - WebP/AVIF format conversion
 * - Blur placeholder for better UX
 * - Quality optimization (default 85)
 *
 * Usage:
 * ```tsx
 * <OptimizedImage
 *   src="/path/to/image.jpg"
 *   alt="Description"
 *   width={400}
 *   height={300}
 * />
 * ```
 */

interface OptimizedImageProps extends Omit<ImageProps, 'quality' | 'placeholder'> {
	/**
	 * Image quality (1-100). Default: 85
	 * Lower values = smaller file size but lower quality
	 */
	quality?: number;
	/**
	 * Enable blur placeholder. Default: true for remote images
	 */
	enableBlur?: boolean;
	/**
	 * Custom blur data URL (base64 encoded image)
	 */
	blurDataURL?: string;
}

export function OptimizedImage({
	src,
	alt,
	className,
	quality = 85,
	enableBlur = true,
	blurDataURL,
	priority = false,
	loading,
	...props
}: OptimizedImageProps) {
	// Determine if this is a remote image
	const isRemoteImage = typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'));

	// Use blur placeholder for remote images by default
	const shouldBlur = enableBlur && isRemoteImage;

	return (
		<Image
			src={src}
			alt={alt}
			className={cn('object-cover', className)}
			quality={quality}
			loading={loading || (priority ? undefined : 'lazy')}
			priority={priority}
			placeholder={shouldBlur ? 'blur' : 'empty'}
			blurDataURL={blurDataURL || (shouldBlur ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' : undefined)}
			{...props}
		/>
	);
}

/**
 * Avatar-specific optimized image with fallback handling
 *
 * Features:
 * - Circular by default
 * - Handles missing/broken images gracefully
 * - Optimized for profile pictures
 *
 * Usage:
 * ```tsx
 * <AvatarImage
 *   src={user.image}
 *   alt={user.name}
 *   size={48}
 *   fallback={<UserIcon />}
 * />
 * ```
 */

interface AvatarImageProps {
	src: string | null | undefined;
	alt: string;
	size?: number;
	className?: string;
	fallback?: React.ReactNode;
	priority?: boolean;
}

export function AvatarImage({ src, alt, size = 40, className, fallback, priority = false }: AvatarImageProps) {
	if (!src && fallback) {
		return <>{fallback}</>;
	}

	if (!src) {
		return null;
	}

	return (
		<OptimizedImage
			src={src}
			alt={alt}
			width={size}
			height={size}
			className={cn('rounded-full', className)}
			quality={90}
			priority={priority}
		/>
	);
}

/**
 * Item image with consistent aspect ratio and loading states
 *
 * Features:
 * - 4:3 aspect ratio by default
 * - Optimized for product/item images
 * - Cover fit by default
 *
 * Usage:
 * ```tsx
 * <ItemImage
 *   src={item.imageUrl}
 *   alt={item.name}
 *   aspectRatio="4/3"
 * />
 * ```
 */

interface ItemImageProps {
	src: string | null | undefined;
	alt: string;
	width?: number;
	height?: number;
	aspectRatio?: '1/1' | '4/3' | '16/9' | '3/4';
	className?: string;
	priority?: boolean;
}

export function ItemImage({
	src,
	alt,
	width = 400,
	height = 300,
	aspectRatio = '4/3',
	className,
	priority = false,
}: ItemImageProps) {
	if (!src) {
		return (
			<div
				className={cn('bg-muted flex items-center justify-center', className)}
				style={{ aspectRatio }}
			>
				<span className="text-muted-foreground text-sm">No image</span>
			</div>
		);
	}

	return (
		<div className={cn('relative overflow-hidden', className)} style={{ aspectRatio }}>
			<OptimizedImage
				src={src}
				alt={alt}
				width={width}
				height={height}
				className="object-cover w-full h-full"
				priority={priority}
			/>
		</div>
	);
}
