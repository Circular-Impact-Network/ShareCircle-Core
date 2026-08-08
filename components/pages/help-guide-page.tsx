'use client';

import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, PageShell } from '@/components/ui/page';

/**
 * The screen-by-screen help guide, served from Supabase storage via /api/docs/help.
 *
 * Rendered in an iframe with no `allow-scripts`. The document we ship today contains no script at
 * all, but it is replaceable by upload without a code review, so the page it lands in must not be
 * able to grant it anything. Sandboxed, it cannot reach the session, cookies or our origin no
 * matter what a future upload contains.
 */
export function HelpGuidePage() {
	return (
		<PageShell>
			<PageHeader
				title="Help & Guide"
				description="A walkthrough of every screen in ShareCircle, and what to expect on each."
				actions={
					<Button variant="outline" size="sm" asChild>
						<a href="/api/docs/help" target="_blank" rel="noopener noreferrer">
							Open in a new tab
							<ExternalLink className="ml-2 h-4 w-4" />
						</a>
					</Button>
				}
			/>

			<div className="overflow-hidden rounded-xl border border-border/60 bg-card">
				<iframe
					src="/api/docs/help"
					title="ShareCircle help guide"
					// No allow-scripts, and no allow-same-origin: the document is treated as untrusted
					// content that happens to be ours.
					sandbox=""
					className="h-[calc(100dvh-13rem)] w-full border-0 bg-white"
					loading="lazy"
				/>
			</div>
		</PageShell>
	);
}
