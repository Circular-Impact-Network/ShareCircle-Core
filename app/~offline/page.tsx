import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
	return (
		<div className="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-12">
			<div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
				<div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
					SC
				</div>
				<h1 className="text-2xl font-semibold text-foreground">You&apos;re offline</h1>
				<p className="mt-3 text-sm leading-6 text-muted-foreground">
					ShareCircle is still available in a limited mode. Reconnect to send messages, upload photos,
					or publish item changes.
				</p>
				<div className="mt-6 flex flex-col gap-3">
					<Button asChild className="w-full">
						<Link href="/home">Go to Home</Link>
					</Button>
					<Button asChild variant="outline" className="w-full">
						<Link href="/messages">Open Messages</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
