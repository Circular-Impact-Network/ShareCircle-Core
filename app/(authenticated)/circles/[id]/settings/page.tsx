import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeletons';

const CircleSettingsPage = dynamic(
	() =>
		import('@/components/pages/circle-settings-page').then(m => ({
			default: m.CircleSettingsPage,
		})),
	{ loading: () => <PageSkeleton /> },
);

interface CircleSettingsRouteProps {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ tab?: string }>;
}

export default async function CircleSettingsRoute({ params, searchParams }: CircleSettingsRouteProps) {
	const { id } = await params;
	const { tab } = await searchParams;
	return <CircleSettingsPage circleId={id} defaultTab={tab} />;
}
