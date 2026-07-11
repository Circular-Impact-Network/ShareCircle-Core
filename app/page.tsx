import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Marketing now lives on the main CIN website (circularimpact.org/sharecircle).
// The app root is purely a router: signed-in users go to the app, everyone else to login.
// Middleware handles this redirect too; this is the fallback for paths that skip it.
export default async function RootPage() {
	const session = await getServerSession(authOptions);
	redirect(session?.user?.id ? '/home' : '/login');
}
