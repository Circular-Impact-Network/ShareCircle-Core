'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type'>;

export function PasswordInput({ className, disabled, ...props }: PasswordInputProps) {
	const [isVisible, setIsVisible] = useState(false);

	return (
		<div className="relative">
			<Input
				{...props}
				disabled={disabled}
				type={isVisible ? 'text' : 'password'}
				className={cn('pr-10', className)}
			/>
			<button
				type="button"
				onClick={() => setIsVisible(prev => !prev)}
				disabled={disabled}
				className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-foreground/70 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
				aria-label={isVisible ? 'Hide password' : 'Show password'}
			>
				{isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
			</button>
		</div>
	);
}
