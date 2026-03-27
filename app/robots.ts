import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: '*',
				allow: '/',
				disallow: ['/api/', '/settings/', '/messages/', '/activity/', '/listings/', '/notifications/'],
			},
		],
		sitemap: 'https://sharecircle.app/sitemap.xml',
	};
}
