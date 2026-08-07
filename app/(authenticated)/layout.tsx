import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { Sidebar } from '@/components/app/sidebar';
import { MobileHeader } from '@/components/app/mobile-header';
import { BottomNav } from '@/components/app/bottom-nav';
import { NotificationsProvider } from '@/components/providers/notifications-provider';
import { GlobalPresenceProvider } from '@/hooks/useGlobalPresence';
import { AuthenticatedClientShell } from './_components/authenticated-client-shell';

/**
 * Server Component. middleware.ts does the redirect work (auth, email verification, profile
 * completion); this is a second, cheap check so the shell is never rendered to a signed-out
 * visitor if a path slips past the matcher.
 *
 * It used to say it "trusts middleware.ts" and check nothing — and the matcher excluded every
 * path containing a dot, so `/items/abc.def` rendered the whole authenticated shell to anybody.
 * One gate with a hole in it is not a gate.
 */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		redirect('/login');
	}

	return (
		<NotificationsProvider>
			{/* App-wide presence: "online" now means the app is open, not just the Messages tab. */}
			<GlobalPresenceProvider>
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
			</GlobalPresenceProvider>
		</NotificationsProvider>
	);
}
