'use client';

import { format } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDayPicker } from 'react-day-picker';
import type { Matcher, MonthCaptionProps } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const MONTHS = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
];

function MonthYearCaption({ calendarMonth }: MonthCaptionProps) {
	const { goToMonth, previousMonth, nextMonth, dayPickerProps } = useDayPicker();
	const date = calendarMonth.date;
	const currentMonth = date.getMonth();
	const currentYear = date.getFullYear();

	const startYear = dayPickerProps.startMonth?.getFullYear() ?? 1900;
	const endYear = dayPickerProps.endMonth?.getFullYear() ?? (new Date().getFullYear() + 5);
	const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

	return (
		<div className="flex items-center justify-between w-full">
			<Button
				type="button"
				variant="outline"
				size="icon"
				className="size-7 bg-transparent p-0 opacity-50 hover:opacity-100"
				disabled={!previousMonth}
				onClick={() => previousMonth && goToMonth(previousMonth)}
			>
				<ChevronLeft className="size-4" />
			</Button>
			<div className="flex items-center gap-1 text-sm font-medium">
				<select
					value={currentMonth}
					onChange={e => goToMonth(new Date(currentYear, Number(e.target.value), 1))}
					className="appearance-none bg-transparent cursor-pointer outline-none hover:text-primary transition-colors"
				>
					{MONTHS.map((m, i) => (
						<option key={i} value={i}>{m}</option>
					))}
				</select>
				<select
					value={currentYear}
					onChange={e => goToMonth(new Date(Number(e.target.value), currentMonth, 1))}
					className="appearance-none bg-transparent cursor-pointer outline-none hover:text-primary transition-colors"
				>
					{years.map(y => (
						<option key={y} value={y}>{y}</option>
					))}
				</select>
			</div>
			<Button
				type="button"
				variant="outline"
				size="icon"
				className="size-7 bg-transparent p-0 opacity-50 hover:opacity-100"
				disabled={!nextMonth}
				onClick={() => nextMonth && goToMonth(nextMonth)}
			>
				<ChevronRight className="size-4" />
			</Button>
		</div>
	);
}

type DatePickerProps = {
	value?: Date;
	onChange: (date: Date | undefined) => void;
	placeholder?: string;
	fromYear?: number;
	toYear?: number;
	disabled?: Matcher | Matcher[];
	className?: string;
	triggerClassName?: string;
	align?: 'start' | 'center' | 'end';
};

export function DatePicker({
	value,
	onChange,
	placeholder = 'Pick a date',
	fromYear,
	toYear,
	disabled,
	className,
	triggerClassName,
	align = 'start',
}: DatePickerProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className={cn(
						'w-full justify-start text-left font-normal',
						!value && 'text-muted-foreground',
						triggerClassName,
					)}
				>
					<CalendarIcon className="mr-2 h-4 w-4 opacity-60 shrink-0" />
					{value ? format(value, 'MMM d, yyyy') : placeholder}
				</Button>
			</PopoverTrigger>
			<PopoverContent className={cn('w-auto p-0', className)} align={align}>
				<Calendar
					mode="single"
					selected={value}
					onSelect={onChange}
					disabled={disabled}
					startMonth={fromYear !== undefined ? new Date(fromYear, 0) : undefined}
					endMonth={toYear !== undefined ? new Date(toYear, 11) : undefined}
					defaultMonth={value ?? (toYear !== undefined ? new Date(toYear, 0) : undefined)}
					classNames={{
						month_caption: 'flex items-center px-1 pb-1',
						nav: 'hidden',
					}}
					components={{ MonthCaption: MonthYearCaption }}
				/>
			</PopoverContent>
		</Popover>
	);
}
