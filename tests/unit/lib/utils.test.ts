/**
 * Unit tests for utility functions
 * Tests: cn (className merger)
 */

import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('Utility Functions', () => {
	describe('cn (className merger)', () => {
		it('merges multiple class names', () => {
			const result = cn('class1', 'class2', 'class3');
			expect(result).toBe('class1 class2 class3');
		});

		it('handles conditional classes', () => {
			const isActive = true;
			const isDisabled = false;
			
			const result = cn(
				'base-class',
				isActive && 'active',
				isDisabled && 'disabled'
			);
			
			expect(result).toBe('base-class active');
		});

		it('handles undefined and null values', () => {
			const result = cn('base', undefined, null, 'end');
			expect(result).toBe('base end');
		});

		it('handles empty strings', () => {
			const result = cn('base', '', 'end');
			expect(result).toBe('base end');
		});

		it('merges Tailwind classes correctly (last wins)', () => {
			// tailwind-merge should handle conflicting classes
			const result = cn('p-4', 'p-8');
			expect(result).toBe('p-8');
		});

		it('merges text color classes correctly', () => {
			const result = cn('text-red-500', 'text-blue-500');
			expect(result).toBe('text-blue-500');
		});

		it('keeps non-conflicting classes', () => {
			const result = cn('p-4', 'm-4', 'text-red-500');
			expect(result).toBe('p-4 m-4 text-red-500');
		});

		it('handles array of class names', () => {
			const result = cn(['class1', 'class2']);
			expect(result).toBe('class1 class2');
		});

		it('handles object syntax from clsx', () => {
			const result = cn({
				'base-class': true,
				'active': true,
				'disabled': false,
			});
			expect(result).toBe('base-class active');
		});

		it('handles mixed inputs', () => {
			const result = cn(
				'base',
				['array-class'],
				{ 'object-class': true, 'disabled': false },
				'end'
			);
			expect(result).toBe('base array-class object-class end');
		});

		it('handles complex Tailwind responsive classes', () => {
			const result = cn(
				'flex',
				'md:hidden',
				'lg:flex',
				'items-center'
			);
			expect(result).toBe('flex md:hidden lg:flex items-center');
		});

		it('handles hover and focus states', () => {
			const result = cn(
				'bg-white',
				'hover:bg-gray-100',
				'focus:ring-2'
			);
			expect(result).toBe('bg-white hover:bg-gray-100 focus:ring-2');
		});

		it('returns empty string for no inputs', () => {
			const result = cn();
			expect(result).toBe('');
		});

		it('returns empty string for all falsy inputs', () => {
			const result = cn(undefined, null, false, '');
			expect(result).toBe('');
		});
	});
});
