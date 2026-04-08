import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeletons';

const CircleDetailsPage = dynamic(
	() =>
		import('@/components/pages/circle-details-page').then((m) => ({
			default: m.CircleDetailsPage,
		})),
	{ loading: () => <PageSkeleton /> }
);

interface CircleDetailRouteProps {
	params: Promise<{ id: string }>;
}

export default async function CircleDetailRoute({ params }: CircleDetailRouteProps) {
	const { id } = await params;
	return <CircleDetailsPage circleId={id} />;
}
