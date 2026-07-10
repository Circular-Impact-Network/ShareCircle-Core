'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

interface NoCircleStateProps {
	/** Context-specific title, e.g. "No items to browse yet". Defaults to a generic onboarding title. */
	title?: string;
	/** Context-specific description. Defaults to a generic onboarding explanation. */
	description?: string;
	className?: string;
}

/**
 * Circle-aware empty state shown wherever a user with zero circles would otherwise
 * see a generic/confusing empty screen (dashboard, browse, messages, my listings).
 * Explains why the screen is empty and funnels the user to create or join a circle.
 */
export function NoCircleState({
	title = "You're not in a ShareCircle yet",
	description = 'Circles are private groups where you share and borrow items with people you trust. Join or create one to get started.',
	className,
}: NoCircleStateProps) {
	return (
		<EmptyState
			icon={Users}
			title={title}
			description={description}
			className={className}
			action={
				<div className="flex flex-wrap justify-center gap-2">
					<Button asChild size="sm">
						<Link href="/circles">Create a circle</Link>
					</Button>
					<Button asChild size="sm" variant="outline">
						<Link href="/circles">Join with a code</Link>
					</Button>
				</div>
			}
		/>
	);
}
