import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { LandingPage } from '@/components/pages/landing-page';

// The marketing landing page lives at the site root so visiting the domain shows
// the real website (it no longer redirects signed-in users straight to /home).
// Signed-in visitors get auth-aware CTAs that point into the app.
export default async function RootPage() {
	const session = await getServerSession(authOptions);
	return <LandingPage isAuthenticated={!!session?.user?.id} />;
}
