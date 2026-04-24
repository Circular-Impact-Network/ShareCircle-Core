'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn('p-3', className)}
			classNames={{
				// Outer containers — v9 keys
				months: 'flex flex-col gap-4 sm:flex-row',
				month: 'relative flex flex-col gap-4',
				// Caption row (month + year label) — v9: month_caption + caption_label
				month_caption: 'flex justify-center items-center h-7',
				caption_label: 'text-sm font-medium',
				// Navigation — v9: nav, button_previous, button_next
				nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
				button_previous: cn(
					buttonVariants({ variant: 'outline' }),
					'size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
				),
				button_next: cn(
					buttonVariants({ variant: 'outline' }),
					'size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
				),
				// Grid — v9: month_grid (the <table>)
				month_grid: 'w-full border-collapse',
				// Weekday headers — v9: weekdays (<tr>), weekday (<th>)
				weekdays: '',
				weekday: 'text-muted-foreground w-8 font-normal text-[0.8rem] text-center pb-1',
				// Week rows — v9: weeks (<tbody>), week (<tr>)
				weeks: '',
				week: '',
				// Day cell and button — v9: day (<td>), day_button (<button>)
				day: cn(
					'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
					'[&:has([aria-selected])]:bg-accent',
					'first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
					'[&:has([aria-selected].outside)]:bg-accent/50',
					'[&:has([aria-selected].range_end)]:rounded-r-md',
				),
				day_button: cn(buttonVariants({ variant: 'ghost' }), 'size-8 p-0 font-normal aria-selected:opacity-100'),
				// Day state modifiers — v9 SelectionState + DayFlag keys
				selected:
					'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
				today: 'bg-accent text-accent-foreground',
				outside: 'outside text-muted-foreground opacity-50 aria-selected:text-muted-foreground',
				disabled: 'text-muted-foreground opacity-30 cursor-not-allowed',
				range_start: 'range_start aria-selected:bg-primary aria-selected:text-primary-foreground',
				range_end: 'range_end aria-selected:bg-primary aria-selected:text-primary-foreground',
				range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
				hidden: 'invisible',
				...classNames,
			}}
			components={{
				Chevron: ({ orientation }) =>
					orientation === 'left' ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />,
			}}
			{...props}
		/>
	);
}

Calendar.displayName = 'Calendar';

export { Calendar };
