/**
 * The requirement is "every displayed weight follows the unit chosen in Settings".
 *
 * These render the real components under both units and assert the string a user would actually
 * read. Asserting the formatter alone would not have caught the bug that prompted this: the
 * formatter was correct and simply was not called — impact figures printed raw kilograms, and both
 * item modals labelled their input "Weight (kg)" no matter what the user had chosen.
 */

import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WeightUnit } from '@/lib/units';
import type { CurrencyCode } from '@/lib/currency';

const preferences = {
	weightUnit: 'kg' as WeightUnit,
	currency: 'USD' as CurrencyCode,
};

vi.mock('@/lib/preferences-context', () => ({
	usePreferences: () => ({
		theme: 'light',
		toggleTheme: vi.fn(),
		fontSize: 'md',
		setFontSize: vi.fn(),
		weightUnit: preferences.weightUnit,
		setWeightUnit: vi.fn(),
		currency: preferences.currency,
		setCurrency: vi.fn(),
		fxRates: { USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.5, CAD: 1.36, AUD: 1.52 },
	}),
	useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

const impactQuery = vi.fn();
vi.mock('@/lib/redux/api/impactApi', () => ({
	useGetUserImpactQuery: () => impactQuery(),
}));

import { ImpactPanel } from '@/components/impact/impact-panel';
import { WeightInput } from '@/components/items/weight-input';
import { PriceHint } from '@/components/items/price-hint';

beforeEach(() => {
	preferences.weightUnit = 'kg';
	preferences.currency = 'USD';
	impactQuery.mockReturnValue({
		isLoading: false,
		data: { moneySavedUsd: 100, co2AvoidedKg: 1234.56, timesBorrowed: 3, itemsShared: 2 },
	});
});

describe('impact figures follow the weight preference', () => {
	it('shows kilograms when the user picked kg', () => {
		render(<ImpactPanel />);
		expect(screen.getByText('1,234.6 kg')).toBeInTheDocument();
	});

	it('shows pounds when the user picked lbs', () => {
		preferences.weightUnit = 'lbs';
		render(<ImpactPanel />);
		// 1234.56 kg * 2.20462 = 2721.7357 lbs
		expect(screen.getByText('2,721.7 lbs')).toBeInTheDocument();
		expect(screen.queryByText(/kg/)).not.toBeInTheDocument();
	});
});

/**
 * `WeightInput` is controlled: its contract is that the parent stores whatever it emits and feeds
 * it straight back, which is exactly what both item modals do. Driving it with a `vi.fn()` that
 * swallows the value would test a parent that does not exist anywhere in the app.
 */
function renderControlled(initialKg: number | null = null) {
	// Recorded in the change handler rather than during render — assigning to an outer variable
	// while rendering is exactly the kind of side effect the hooks lint rule exists to stop.
	const box: { value: number | null } = { value: initialKg };

	function Harness() {
		const [kg, setKg] = useState<number | null>(initialKg);
		return (
			<WeightInput
				id="w"
				valueKg={kg}
				onChangeKg={next => {
					box.value = next;
					setKg(next);
				}}
			/>
		);
	}

	render(<Harness />);
	return { latest: () => box.value };
}

describe('weight input follows the weight preference', () => {
	it('labels the field in the chosen unit', () => {
		const { rerender } = render(<WeightInput id="w" valueKg={null} onChangeKg={vi.fn()} />);
		expect(screen.getByLabelText('Weight (kg)')).toBeInTheDocument();

		preferences.weightUnit = 'lbs';
		rerender(<WeightInput id="w" valueKg={null} onChangeKg={vi.fn()} />);
		expect(screen.getByLabelText('Weight (lbs)')).toBeInTheDocument();
	});

	it('displays a stored kilogram value converted into pounds', () => {
		preferences.weightUnit = 'lbs';
		render(<WeightInput id="w" valueKg={10} onChangeKg={vi.fn()} />);
		expect(screen.getByTestId('weight-input')).toHaveValue(22.05);
	});

	it('converts typed pounds back to kilograms before storing', async () => {
		preferences.weightUnit = 'lbs';
		const { latest } = renderControlled();

		await userEvent.type(screen.getByTestId('weight-input'), '22');

		// The item is stored in kg regardless of the unit the user typed in.
		expect(latest()).toBeCloseTo(9.979, 2);
		// ...and what they typed still reads back to them unchanged.
		expect(screen.getByTestId('weight-input')).toHaveValue(22);
	});

	it('stores kilograms unchanged when the user is on kg', async () => {
		const { latest } = renderControlled();

		await userEvent.type(screen.getByTestId('weight-input'), '7');

		expect(latest()).toBe(7);
	});

	it('emits null for an emptied field rather than NaN', async () => {
		const { latest } = renderControlled(5);

		await userEvent.clear(screen.getByTestId('weight-input'));

		expect(latest()).toBeNull();
	});

	it('keeps half-typed input intact instead of clearing it', async () => {
		const { latest } = renderControlled();

		await userEvent.type(screen.getByTestId('weight-input'), '2.');

		// "2." is not yet a number worth storing, but the user must be able to keep typing.
		expect(screen.getByTestId('weight-input')).toHaveValue(2);
		expect(latest()).toBe(2);
	});
});

describe('price hint', () => {
	it('stays hidden for a USD user, who needs no conversion', () => {
		render(<PriceHint usd={120} />);
		expect(screen.queryByTestId('price-hint')).not.toBeInTheDocument();
	});

	it('converts into the chosen currency', () => {
		preferences.currency = 'INR';
		render(<PriceHint usd={120} />);
		// 120 USD * 83.5 = 10,020
		expect(screen.getByTestId('price-hint')).toHaveTextContent('10,020');
	});

	it('renders nothing when there is no price', () => {
		preferences.currency = 'INR';
		render(<PriceHint usd={null} />);
		expect(screen.queryByTestId('price-hint')).not.toBeInTheDocument();
	});
});
