'use client';

import * as React from 'react';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>[0];
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
	opts?: CarouselOptions;
	plugins?: CarouselPlugin;
	orientation?: 'horizontal' | 'vertical';
	setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
	carouselRef: ReturnType<typeof useEmblaCarousel>[0];
	api: ReturnType<typeof useEmblaCarousel>[1];
	scrollPrev: () => void;
	scrollNext: () => void;
	canScrollPrev: boolean;
	canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
	const context = React.useContext(CarouselContext);

	if (!context) {
		throw new Error('useCarousel must be used within a <Carousel />');
	}

	return context;
}

const Carousel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & CarouselProps>(
	({ orientation = 'horizontal', opts, setApi, plugins, className, children, ...props }, ref) => {
		const [carouselRef, api] = useEmblaCarousel(
			{
				...opts,
				axis: orientation === 'horizontal' ? 'x' : 'y',
				loop: opts?.loop ?? true,
				dragFree: opts?.dragFree ?? false,
				containScroll: opts?.containScroll ?? 'trimSnaps',
				skipSnaps: opts?.skipSnaps ?? false,
				align: opts?.align ?? 'start',
				watchDrag: opts?.watchDrag ?? true,
				watchResize: opts?.watchResize ?? true,
				watchSlides: opts?.watchSlides ?? true,
			},
			plugins,
		);
		const [canScrollPrev, setCanScrollPrev] = React.useState(false);
		const [canScrollNext, setCanScrollNext] = React.useState(false);

		const onSelect = React.useCallback((api: CarouselApi) => {
			if (!api) {
				return;
			}

			setCanScrollPrev(api.canScrollPrev());
			setCanScrollNext(api.canScrollNext());
		}, []);

		const scrollPrev = React.useCallback(() => {
			api?.scrollPrev();
		}, [api]);

		const scrollNext = React.useCallback(() => {
			api?.scrollNext();
		}, [api]);

		const handleKeyDown = React.useCallback(
			(event: React.KeyboardEvent<HTMLDivElement>) => {
				if (event.key === 'ArrowLeft') {
					event.preventDefault();
					scrollPrev();
				} else if (event.key === 'ArrowRight') {
					event.preventDefault();
					scrollNext();
				}
			},
			[scrollPrev, scrollNext],
		);

		React.useEffect(() => {
			if (!api || !setApi) {
				return;
			}

			setApi(api);
		}, [api, setApi]);

		React.useEffect(() => {
			if (!api) {
				return;
			}

			onSelect(api);
			api.on('reInit', onSelect);
			api.on('select', onSelect);

			return () => {
				api?.off('select', onSelect);
			};
		}, [api, onSelect]);

		return (
			<CarouselContext.Provider
				value={{
					carouselRef,
					api: api,
					opts,
					orientation: orientation || (opts?.axis === 'y' ? 'vertical' : 'horizontal'),
					scrollPrev,
					scrollNext,
					canScrollPrev,
					canScrollNext,
				}}
			>
				<div
					ref={ref}
					onKeyDownCapture={handleKeyDown}
					className={cn('relative', className)}
					role="region"
					aria-label="Carousel"
					{...props}
				>
					{children}
				</div>
			</CarouselContext.Provider>
		);
	},
);
Carousel.displayName = 'Carousel';

const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => {
		const { carouselRef, orientation } = useCarousel();

		return (
			<div ref={carouselRef} className="overflow-hidden h-full">
				<div
					ref={ref}
					className={cn('flex', orientation === 'horizontal' ? '-ml-4' : '-mt-4 flex-col', className)}
					{...props}
				/>
			</div>
		);
	},
);
CarouselContent.displayName = 'CarouselContent';

const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => {
		const { orientation } = useCarousel();

		return (
			<div
				ref={ref}
				role="group"
				aria-roledescription="slide"
				className={cn(
					'min-w-0 shrink-0 grow-0 basis-full',
					orientation === 'horizontal' ? 'pl-4' : 'pt-4',
					className,
				)}
				{...props}
			/>
		);
	},
);
CarouselItem.displayName = 'CarouselItem';

const CarouselPrevious = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
	({ className, variant = 'ghost', size = 'icon', onClick, ...props }, ref) => {
		const { orientation, scrollPrev, canScrollPrev } = useCarousel();

		const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
			e.stopPropagation();
			scrollPrev();
			onClick?.(e);
		};

		return (
			<Button
				ref={ref}
				variant={variant}
				size={size}
				className={cn(
					'absolute h-10 w-10 rounded-full bg-white text-black shadow-lg opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity duration-200 z-10 hover:bg-white/90 hover:text-black',
					orientation === 'horizontal'
						? 'left-2 top-1/2 -translate-y-1/2'
						: 'top-2 left-1/2 -translate-x-1/2 rotate-90',
					className,
				)}
				disabled={!canScrollPrev}
				onClick={handleClick}
				{...props}
			>
				<ArrowLeft className="h-5 w-5" />
				<span className="sr-only">Previous slide</span>
			</Button>
		);
	},
);
CarouselPrevious.displayName = 'CarouselPrevious';

const CarouselNext = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
	({ className, variant = 'ghost', size = 'icon', onClick, ...props }, ref) => {
		const { orientation, scrollNext, canScrollNext } = useCarousel();

		const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
			e.stopPropagation();
			scrollNext();
			onClick?.(e);
		};

		return (
			<Button
				ref={ref}
				variant={variant}
				size={size}
				className={cn(
					'absolute h-10 w-10 rounded-full bg-white text-black shadow-lg opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity duration-200 z-10 hover:bg-white/90 hover:text-black',
					orientation === 'horizontal'
						? 'right-2 top-1/2 -translate-y-1/2'
						: 'bottom-2 left-1/2 -translate-x-1/2 rotate-90',
					className,
				)}
				disabled={!canScrollNext}
				onClick={handleClick}
				{...props}
			>
				<ArrowRight className="h-5 w-5" />
				<span className="sr-only">Next slide</span>
			</Button>
		);
	},
);
CarouselNext.displayName = 'CarouselNext';

// Custom components for dots and number indicators
type CarouselDotsProps = {
	className?: string;
};

const CarouselDots = React.forwardRef<HTMLDivElement, CarouselDotsProps>(({ className, ...props }, ref) => {
	const { api } = useCarousel();
	const [selectedIndex, setSelectedIndex] = React.useState(0);
	const [scrollSnaps, setScrollSnaps] = React.useState<number[]>([]);

	const scrollTo = React.useCallback((index: number, e?: React.MouseEvent) => {
		e?.stopPropagation();
		api?.scrollTo(index);
	}, [api]);

	const onSelect = React.useCallback(() => {
		if (!api) return;
		setSelectedIndex(api.selectedScrollSnap());
	}, [api]);

	React.useEffect(() => {
		if (!api) return;

		setScrollSnaps(api.scrollSnapList());
		setSelectedIndex(api.selectedScrollSnap());
		api.on('select', onSelect);
		api.on('reInit', onSelect);

		return () => {
			api.off('select', onSelect);
		};
	}, [api, onSelect]);

	if (scrollSnaps.length <= 1) return null;

	return (
		<div
			ref={ref}
			className={cn('flex justify-center gap-2 mt-4', className)}
			onClick={(e) => e.stopPropagation()}
			{...props}
		>
			{scrollSnaps.map((_, index) => (
				<button
					key={index}
					type="button"
					onClick={(e) => scrollTo(index, e)}
					className={cn(
						'h-2 w-2 rounded-full transition-all',
						index === selectedIndex ? 'bg-primary w-6' : 'bg-muted-foreground/50',
					)}
					aria-label={`Go to slide ${index + 1}`}
				/>
			))}
		</div>
	);
});
CarouselDots.displayName = 'CarouselDots';

type CarouselNumberProps = {
	className?: string;
};

const CarouselNumber = React.forwardRef<HTMLDivElement, CarouselNumberProps>(({ className, ...props }, ref) => {
	const { api } = useCarousel();
	const [selectedIndex, setSelectedIndex] = React.useState(0);
	const [count, setCount] = React.useState(0);

	const onSelect = React.useCallback(() => {
		if (!api) return;
		setSelectedIndex(api.selectedScrollSnap());
		setCount(api.scrollSnapList().length);
	}, [api]);

	React.useEffect(() => {
		if (!api) return;

		setSelectedIndex(api.selectedScrollSnap());
		setCount(api.scrollSnapList().length);
		api.on('select', onSelect);
		api.on('reInit', onSelect);

		return () => {
			api.off('select', onSelect);
		};
	}, [api, onSelect]);

	if (count <= 1) return null;

	return (
		<div
			ref={ref}
			className={cn(
				'absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded',
				className,
			)}
			onClick={(e) => e.stopPropagation()}
			{...props}
		>
			{selectedIndex + 1}/{count}
		</div>
	);
});
CarouselNumber.displayName = 'CarouselNumber';

export {
	type CarouselApi,
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselPrevious,
	CarouselNext,
	CarouselDots,
	CarouselNumber,
};
