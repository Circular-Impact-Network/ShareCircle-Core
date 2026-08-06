import { cn } from '@/lib/utils';

/**
 * Muted inline pill marking a feature that is visible but not yet built (security deposit,
 * raise a concern, phone auth). Purely visual — no tooltip, no interaction.
 *
 * Matches the small-pill style already used on the activity cards.
 */
export function ComingSoonPill({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				'inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground',
				className,
			)}
		>
			Coming soon
		</span>
	);
}
