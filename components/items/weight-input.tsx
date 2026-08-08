'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePreferences } from '@/lib/preferences-context';
import { fromKg, toKg } from '@/lib/units';

type WeightInputProps = {
	id: string;
	/** Always kilograms — the unit the item is stored in, regardless of what is displayed. */
	valueKg: number | null;
	onChangeKg: (kg: number | null) => void;
	className?: string;
};

/**
 * Weight field that accepts and displays the user's chosen unit while storing kilograms.
 *
 * Both item modals hard-coded "Weight (kg)", so anyone set to pounds typed a pound figure into a
 * kilogram field and the item was saved roughly 2.2x too heavy — with no way to tell from the UI.
 * Shared between add and edit deliberately: two copies of a conversion are two chances to fix only
 * one of them.
 *
 * The typed text is held as its own state rather than re-derived from `valueKg` on each keystroke.
 * Deriving it means every character round-trips through a conversion, which mangles half-typed
 * values like "2." and fights the user's cursor.
 */
export function WeightInput({ id, valueKg, onChangeKg, className }: WeightInputProps) {
	const { weightUnit } = usePreferences();

	const display = (kg: number | null, unit: typeof weightUnit) => (kg == null ? '' : String(fromKg(kg, unit)));

	// The typed text is kept alongside the value and unit it was produced from. Holding all three
	// together is what lets the component tell its own echo apart from a genuine external change,
	// without an effect: after the user types, the parent sends `valueKg` straight back, and
	// comparing against the remembered `kg` shows there is nothing to restate.
	const [state, setState] = useState(() => ({
		text: display(valueKg, weightUnit),
		kg: valueKg,
		unit: weightUnit,
	}));

	if (state.kg !== valueKg || state.unit !== weightUnit) {
		// Adjusting state during render rather than in an effect — React's documented pattern for
		// state derived from props. An effect here re-renders a second time and the lint rule flags it.
		setState({ text: display(valueKg, weightUnit), kg: valueKg, unit: weightUnit });
	}

	const handleChange = (raw: string) => {
		if (raw.trim() === '') {
			setState({ text: raw, kg: null, unit: weightUnit });
			onChangeKg(null);
			return;
		}

		const parsed = Number.parseFloat(raw);
		// Intermediate text like "2." or "-" parses to NaN or a partial value. Keep what was typed and
		// emit nothing, rather than writing a nonsense weight to the item on every keystroke.
		if (!Number.isFinite(parsed) || parsed < 0) {
			setState(current => ({ ...current, text: raw }));
			return;
		}

		const kg = toKg(parsed, weightUnit);
		setState({ text: raw, kg, unit: weightUnit });
		onChangeKg(kg);
	};

	return (
		<div className={className ?? 'space-y-1.5'}>
			<Label htmlFor={id} className="text-xs text-muted-foreground">
				Weight ({weightUnit})
			</Label>
			<Input
				id={id}
				data-testid="weight-input"
				type="number"
				min="0"
				step="0.1"
				value={state.text}
				onChange={event => handleChange(event.target.value)}
				placeholder={weightUnit === 'kg' ? 'e.g. 1.2' : 'e.g. 2.6'}
				className="h-9"
			/>
		</div>
	);
}
