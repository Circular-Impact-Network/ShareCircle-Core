'use client';

import { Check, X } from 'lucide-react';

import { evaluatePassword } from '@/lib/password-validation';
import { cn } from '@/lib/utils';

type PasswordRequirementsProps = {
	password: string;
	/** When provided, a confirm-password match line is appended to the checklist. */
	confirmPassword?: string;
	className?: string;
};

/**
 * Live password checklist, shown as the user types rather than on submit.
 *
 * Stays hidden until the field has something in it so an untouched form isn't shouting five
 * red crosses at the user. Rules come from `evaluatePassword`, which is derived from the
 * same PASSWORD_REQUIREMENTS the API validates against.
 */
export function PasswordRequirements({ password, confirmPassword, className }: PasswordRequirementsProps) {
	if (!password) {
		return null;
	}

	const rules = evaluatePassword(password);
	const showMatch = confirmPassword !== undefined && confirmPassword.length > 0;

	return (
		<ul className={cn('mt-2 space-y-1', className)} data-testid="password-requirements" aria-live="polite">
			{rules.map(rule => (
				<Rule key={rule.id} met={rule.met} label={rule.label} testId={`password-rule-${rule.id}`} />
			))}
			{showMatch && (
				<Rule
					met={password === confirmPassword}
					label={password === confirmPassword ? 'Passwords match' : 'Passwords do not match yet'}
					testId="password-rule-match"
				/>
			)}
		</ul>
	);
}

function Rule({ met, label, testId }: { met: boolean; label: string; testId: string }) {
	const Icon = met ? Check : X;
	return (
		<li
			className={cn(
				'flex items-center gap-1.5 text-2xs',
				met ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
			)}
			data-testid={testId}
			data-met={met}
		>
			<Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
			<span>{label}</span>
			<span className="sr-only">{met ? '(met)' : '(not met)'}</span>
		</li>
	);
}
