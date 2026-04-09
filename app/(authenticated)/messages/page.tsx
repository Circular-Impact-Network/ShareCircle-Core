import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeletons';

const MessagesPage = dynamic(
	() => import('@/components/pages/messages-page').then((m) => ({ default: m.MessagesPage })),
	{ loading: () => <PageSkeleton /> }
);

export default function MessagesRoute() {
	return <MessagesPage />;
}
