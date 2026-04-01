'use client';

import { cn } from '@/lib/utils';

export type ItemRequestFilterValue = 'from-others' | 'mine' | 'all';

interface ItemRequestFilterProps {
	value: ItemRequestFilterValue;
	onChange: (value: ItemRequestFilterValue) => void;
	className?: string;
}

const OPTIONS: { value: ItemRequestFilterValue; label: string }[] = [
	{ value: 'from-others', label: 'From Others' },
	{ value: 'mine', label: 'My Requests' },
	{ value: 'all', label: 'All' },
];

export function ItemRequestFilter({ value, onChange, className }: ItemRequestFilterProps) {
	return (
		<div className={cn('flex items-center gap-1.5', className)}>
			{OPTIONS.map(option => (
				<button
					key={option.value}
					onClick={() => onChange(option.value)}
					className={cn(
						'px-3 py-1 rounded-full text-sm font-medium transition-colors border',
						value === option.value
							? 'bg-foreground text-background border-foreground'
							: 'bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/30',
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
