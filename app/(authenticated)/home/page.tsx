import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeletons';

const DashboardHome = dynamic(
	() => import('@/components/pages/dashboard-home').then(m => ({ default: m.DashboardHome })),
	{ loading: () => <PageSkeleton /> },
);

export default function HomePage() {
	return <DashboardHome />;
}
