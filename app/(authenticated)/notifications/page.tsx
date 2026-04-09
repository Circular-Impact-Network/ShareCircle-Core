import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeletons';

const NotificationsPage = dynamic(
	() =>
		import('@/components/pages/notifications-page').then((m) => ({
			default: m.NotificationsPage,
		})),
	{ loading: () => <PageSkeleton /> }
);

export default function NotificationsRoute() {
	return <NotificationsPage />;
}
