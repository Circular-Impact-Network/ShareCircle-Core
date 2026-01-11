import { CircleDetailsPage } from '@/components/pages/circle-details-page';

interface CircleDetailRouteProps {
	params: Promise<{ id: string }>;
}

export default async function CircleDetailRoute({ params }: CircleDetailRouteProps) {
	const { id } = await params;
	return <CircleDetailsPage circleId={id} />;
}
