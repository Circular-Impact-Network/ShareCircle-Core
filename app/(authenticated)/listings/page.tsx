import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeletons';

const MyListingsPage = dynamic(
	() => import('@/components/pages/my-listings-page').then(m => ({ default: m.MyListingsPage })),
	{ loading: () => <PageSkeleton /> },
);

export default function ListingsPage() {
	return <MyListingsPage />;
}
