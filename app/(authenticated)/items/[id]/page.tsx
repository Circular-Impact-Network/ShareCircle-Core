'use client';

import { use } from 'react';
import { ItemDetailPage } from '@/components/pages/item-detail-page';

interface ItemRouteProps {
	params: Promise<{ id: string }>;
}

export default function ItemRoute({ params }: ItemRouteProps) {
	const { id } = use(params);
	return <ItemDetailPage itemId={id} />;
}
