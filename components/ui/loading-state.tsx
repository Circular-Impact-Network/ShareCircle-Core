import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
	label?: string;
	className?: string;
}

export function LoadingState({ label = 'Loading...', className }: LoadingStateProps) {
	return (
		<div className={cn('flex flex-col items-center justify-center py-12', className)}>
			<Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
			<p className="text-sm text-muted-foreground">{label}</p>
		</div>
	);
}
