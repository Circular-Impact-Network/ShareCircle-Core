import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

describe('EmptyState', () => {
	it('renders title and description', () => {
		render(<EmptyState title="No items" description="Nothing here yet" />);
		expect(screen.getByText('No items')).toBeTruthy();
		expect(screen.getByText('Nothing here yet')).toBeTruthy();
	});

	it('renders action when provided', () => {
		render(<EmptyState title="Empty" description="No data" action={<button>Create</button>} />);
		expect(screen.getByText('Create')).toBeTruthy();
	});

	it('does not render action when not provided', () => {
		const { container } = render(<EmptyState title="Empty" description="No data" />);
		expect(container.querySelectorAll('button')).toHaveLength(0);
	});

	it('accepts custom icon', () => {
		const { container } = render(<EmptyState icon={Search} title="No results" description="Try again" />);
		// SVG should be rendered (lucide Search icon)
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('accepts className', () => {
		const { container } = render(<EmptyState title="Test" description="Test" className="custom-class" />);
		expect(container.firstElementChild?.classList.contains('custom-class')).toBe(true);
	});
});
