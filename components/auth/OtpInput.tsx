'use client';

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';

type OtpInputProps = {
	value: string[]; // length-6 array of single digits ('' = empty)
	onChange: (next: string[]) => void;
	disabled?: boolean;
	// Optional callback when the user has filled all 6 digits — used to auto-submit.
	onComplete?: (code: string) => void;
	// Focus the first input on mount (matches the previous in-page behavior of
	// focusing the first cell when the OTP flow becomes visible).
	autoFocus?: boolean;
};

// Six-digit OTP input with paste-to-fill and backspace-to-previous behavior.
// Previously duplicated verbatim across app/login/page.tsx and app/signup/page.tsx.
export function OtpInput({ value, onChange, disabled, onComplete, autoFocus }: OtpInputProps) {
	const refs = useRef<(HTMLInputElement | null)[]>([]);

	useEffect(() => {
		if (autoFocus) refs.current[0]?.focus();
	}, [autoFocus]);

	const setDigit = (index: number, digit: string) => {
		if (!/^\d*$/.test(digit)) return;
		const next = [...value];
		next[index] = digit.slice(-1);
		onChange(next);

		if (digit && index < 5) {
			refs.current[index + 1]?.focus();
		}

		const code = next.join('');
		if (code.length === 6 && next.every(d => d !== '')) {
			onComplete?.(code);
		}
	};

	const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Backspace' && !value[index] && index > 0) {
			refs.current[index - 1]?.focus();
		}
	};

	const onPaste = (e: ClipboardEvent) => {
		e.preventDefault();
		const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
		if (pasted.length === 6) {
			const next = pasted.split('');
			onChange(next);
			onComplete?.(pasted);
		}
	};

	return (
		<div className="flex gap-2 justify-center" onPaste={onPaste}>
			{value.map((digit, index) => (
				<Input
					key={index}
					ref={el => {
						refs.current[index] = el;
					}}
					type="text"
					inputMode="numeric"
					maxLength={1}
					value={digit}
					onChange={e => setDigit(index, e.target.value)}
					onKeyDown={e => onKeyDown(index, e)}
					className="w-10 h-12 text-center text-lg font-semibold"
					disabled={disabled}
				/>
			))}
		</div>
	);
}

// Helper: empty 6-digit value, useful for resetting.
export const EMPTY_OTP: string[] = ['', '', '', '', '', ''];
