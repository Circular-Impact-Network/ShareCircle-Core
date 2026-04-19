import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeletons';

const SettingsPage = dynamic(
	() => import('@/components/pages/settings-page').then(m => ({ default: m.SettingsPage })),
	{ loading: () => <PageSkeleton /> },
);

export default function SettingsRoute() {
	return <SettingsPage />;
}
