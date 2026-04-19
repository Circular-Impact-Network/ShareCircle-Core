import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeletons';

const BrowseListingsPage = dynamic(
	() =>
		import('@/components/pages/browse-listings-page').then(m => ({
			default: m.BrowseListingsPage,
		})),
	{ loading: () => <PageSkeleton /> },
);

export default function BrowsePage() {
	return <BrowseListingsPage />;
}
