'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { type Circle } from '@/lib/redux/api/circlesApi';

type UseDraftCirclesOptions = {
	// Whether the surrounding modal/sheet is open — used to gate fetch + reset
	open: boolean;
	// Optional pre-selection (e.g., user opened "Add item" from a specific circle)
	currentCircleId?: string;
};

// Encapsulates the "pick which circles to share a new item with" flow used by
// add-item-modal. Owns the circle list, loading state, and selection state.
export function useDraftCircles({ open, currentCircleId }: UseDraftCirclesOptions) {
	const { toast } = useToast();
	const [circles, setCircles] = useState<Circle[]>([]);
	const [isLoadingCircles, setIsLoadingCircles] = useState(false);
	const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);

	const fetchCircles = useCallback(async () => {
		try {
			setIsLoadingCircles(true);
			const response = await fetch('/api/circles');
			if (!response.ok) throw new Error('Failed to fetch circles');
			const data = (await response.json()) as Circle[];
			setCircles(data);

			// Pre-select current circle if provided; else default to the first one
			if (currentCircleId) {
				setSelectedCircleIds([currentCircleId]);
			} else if (data.length > 0) {
				setSelectedCircleIds([data[0].id]);
			}
		} catch (error) {
			console.error('Failed to fetch circles:', error);
			toast({
				title: 'Error',
				description: 'Failed to load circles',
				variant: 'destructive',
			});
		} finally {
			setIsLoadingCircles(false);
		}
	}, [currentCircleId, toast]);

	useEffect(() => {
		if (open) fetchCircles();
		// fetchCircles dep intentionally omitted to match prior behavior
		// (fetch only on `open` rising edge).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const toggleCircle = useCallback((circleId: string) => {
		setSelectedCircleIds(prev =>
			prev.includes(circleId) ? prev.filter(id => id !== circleId) : [...prev, circleId],
		);
	}, []);

	const allCirclesSelected = circles.length > 0 && selectedCircleIds.length === circles.length;

	const toggleSelectAll = useCallback(() => {
		setSelectedCircleIds(prev => (prev.length === circles.length ? [] : circles.map(c => c.id)));
	}, [circles]);

	const reset = useCallback(() => {
		setSelectedCircleIds(currentCircleId ? [currentCircleId] : []);
	}, [currentCircleId]);

	return {
		circles,
		isLoadingCircles,
		selectedCircleIds,
		setSelectedCircleIds,
		toggleCircle,
		toggleSelectAll,
		allCirclesSelected,
		reset,
	};
}
