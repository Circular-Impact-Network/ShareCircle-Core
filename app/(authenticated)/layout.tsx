import { Sidebar } from '@/components/app/sidebar';
import { MobileHeader } from '@/components/app/mobile-header';
import { BottomNav } from '@/components/app/bottom-nav';
import { NotificationsProvider } from '@/components/providers/notifications-provider';
import { AuthenticatedClientShell } from './_components/authenticated-client-shell';

// Server Component: trusts middleware.ts to gate auth + email-verification redirects.
// Children stream as Server Components; only Sidebar/MobileHeader/BottomNav/NotificationsProvider
// are client islands.
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
	return (
		<NotificationsProvider>
			<AuthenticatedClientShell />
			<div className="flex h-[100dvh] flex-col bg-background">
				<Sidebar />
				<MobileHeader />
				{/* Spacer for slim mobile header */}
				<div className="h-12 shrink-0 lg:hidden" aria-hidden="true" />
				<main
					data-scroll-root="authenticated-main"
					className="app-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto lg:ml-60 pb-bottom-nav lg:pb-0"
				>
					{children}
				</main>
				<BottomNav />
			</div>
		</NotificationsProvider>
	);
}
