import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeletons';

const MyActivityPage = dynamic(
	() =>
		import('@/components/pages/my-activity-page').then((m) => ({ default: m.MyActivityPage })),
	{ loading: () => <PageSkeleton /> }
);

export default function ActivityRoute() {
	return <MyActivityPage />;
}
