import { CircleSettingsPage } from '@/components/pages/circle-settings-page';

interface CircleSettingsRouteProps {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ tab?: string }>;
}

export default async function CircleSettingsRoute({ params, searchParams }: CircleSettingsRouteProps) {
	const { id } = await params;
	const { tab } = await searchParams;
	return <CircleSettingsPage circleId={id} defaultTab={tab} />;
}
