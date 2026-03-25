# Image Optimization Guide

This document explains how to use the optimized image components in ShareCircle for better performance and user experience.

## Overview

ShareCircle uses Next.js Image component with custom optimization utilities to provide:
- Automatic WebP/AVIF conversion
- Lazy loading by default
- Responsive images with proper srcset
- Blur placeholders for remote images
- Automatic quality optimization

## Components

### 1. OptimizedImage

The main image component for general use.

```tsx
import { OptimizedImage } from '@/components/ui/optimized-image';

<OptimizedImage
  src="/path/to/image.jpg"
  alt="Description"
  width={400}
  height={300}
  className="rounded-lg"
/>
```

**Props:**
- `src` - Image URL (local or remote)
- `alt` - Alt text (required for accessibility)
- `width` & `height` - Dimensions in pixels
- `quality` - Image quality 1-100 (default: 85)
- `priority` - Load image immediately (default: false)
- `enableBlur` - Show blur placeholder (default: true for remote images)
- All other Next.js Image props are supported

### 2. AvatarImage

Specialized component for profile pictures and user avatars.

```tsx
import { AvatarImage } from '@/components/ui/optimized-image';

<AvatarImage
  src={user.image}
  alt={user.name}
  size={48}
  fallback={<UserIcon />}
/>
```

**Props:**
- `src` - Avatar URL (can be null/undefined)
- `alt` - User name or description
- `size` - Avatar size in pixels (default: 40)
- `fallback` - Element to show if image is missing
- `priority` - Load immediately (default: false)

**Features:**
- Circular by default
- Graceful fallback handling
- Optimized for profile pictures (quality: 90)

### 3. ItemImage

Optimized for product/item listing images with consistent aspect ratios.

```tsx
import { ItemImage } from '@/components/ui/optimized-image';

<ItemImage
  src={item.imageUrl}
  alt={item.name}
  aspectRatio="4/3"
  width={400}
  height={300}
/>
```

**Props:**
- `src` - Item image URL (can be null/undefined)
- `alt` - Item name or description
- `width` & `height` - Dimensions (default: 400x300)
- `aspectRatio` - '1/1' | '4/3' | '16/9' | '3/4' (default: '4/3')
- `priority` - Load immediately (default: false)

**Features:**
- Consistent aspect ratios across listings
- Shows "No image" placeholder for missing images
- Cover fit by default

## Configuration

### Next.js Config

Image optimization is configured in `next.config.ts`:

```ts
images: {
  formats: ['image/webp', 'image/avif'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '**.supabase.co',
      pathname: '/storage/v1/object/**',
    },
    {
      protocol: 'https',
      hostname: 'lh3.googleusercontent.com',
      pathname: '/**',
    },
  ],
}
```

### Remote Patterns

Allowed remote image sources:
- **Supabase Storage**: `https://*.supabase.co/storage/v1/object/**`
- **Google OAuth**: `https://lh3.googleusercontent.com/**`

To add new remote sources, update the `remotePatterns` array in `next.config.ts`.

## Best Practices

### 1. Always Provide Alt Text

```tsx
// ✅ Good
<OptimizedImage src="/photo.jpg" alt="User holding a red bicycle" width={400} height={300} />

// ❌ Bad
<OptimizedImage src="/photo.jpg" alt="" width={400} height={300} />
```

### 2. Use Priority for Above-the-Fold Images

```tsx
// Hero image - loads immediately
<OptimizedImage
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority={true}
/>

// Below-the-fold image - lazy loaded
<OptimizedImage
  src="/thumbnail.jpg"
  alt="Thumbnail"
  width={300}
  height={200}
  priority={false}
/>
```

### 3. Specify Sizes for Responsive Images

When using `fill` layout, always specify the `sizes` prop:

```tsx
<div className="relative w-full h-64">
  <OptimizedImage
    src="/image.jpg"
    alt="Responsive image"
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  />
</div>
```

### 4. Choose Appropriate Quality

- **Profile pictures**: 90 (already set in AvatarImage)
- **Item listings**: 85 (default)
- **Thumbnails**: 75-80
- **Background images**: 60-70

```tsx
<OptimizedImage
  src="/background.jpg"
  alt="Background"
  width={1920}
  height={1080}
  quality={70}
/>
```

### 5. Use Correct Component for Use Case

```tsx
// ✅ User avatars
<AvatarImage src={user.image} alt={user.name} size={48} />

// ✅ Item listings
<ItemImage src={item.imageUrl} alt={item.name} aspectRatio="4/3" />

// ✅ General images
<OptimizedImage src="/banner.jpg" alt="Banner" width={800} height={200} />
```

## Performance Metrics

Expected improvements:
- **Load time**: 40-60% faster with WebP/AVIF
- **Bandwidth**: 30-50% reduction in image size
- **LCP (Largest Contentful Paint)**: Improved with priority loading
- **CLS (Cumulative Layout Shift)**: Prevented with width/height attributes

## Migration from Standard img Tags

### Before:
```tsx
<img
  src={item.imageUrl}
  alt={item.name}
  className="w-full h-64 object-cover"
  loading="lazy"
/>
```

### After:
```tsx
<ItemImage
  src={item.imageUrl}
  alt={item.name}
  width={400}
  height={300}
  aspectRatio="4/3"
  className="rounded-lg"
/>
```

## Troubleshooting

### Image Not Loading

1. Check if the domain is in `remotePatterns` (next.config.ts)
2. Verify the image URL is accessible
3. Check browser console for errors

### Blurry Images

1. Increase the `quality` prop
2. Ensure `width` and `height` are appropriate for display size
3. Check if WebP/AVIF is supported in the browser

### Slow Loading

1. Use `priority={true}` for above-the-fold images
2. Reduce image quality if appropriate
3. Check if images are being cached (Network tab)

## Additional Resources

- [Next.js Image Documentation](https://nextjs.org/docs/app/api-reference/components/image)
- [Web.dev Image Optimization](https://web.dev/fast/#optimize-your-images)
- [ShareCircle Image Components](./components/ui/optimized-image.tsx)
