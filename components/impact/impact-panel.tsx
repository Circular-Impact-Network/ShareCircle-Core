'use client';

import { Leaf, DollarSign, HandshakeIcon, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGetUserImpactQuery } from '@/lib/redux/api/impactApi';

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
			<div className="flex items-center gap-1.5 text-muted-foreground">
				{icon}
				<span className="text-xs">{label}</span>
			</div>
			<span className="text-xl font-semibold text-foreground sm:text-2xl">{value}</span>
		</div>
	);
}

/**
 * User-level sharing impact summary. Renders money saved, CO2 avoided, and borrow/share
 * counts from /api/impact. Circle/transaction/lead-level views are tracked as follow-ups.
 */
export function ImpactPanel() {
	const { data, isLoading } = useGetUserImpactQuery();

	return (
		<Card className="border-border/60">
			<CardHeader className="space-y-1 pb-3">
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="text-base sm:text-lg">Your impact</CardTitle>
					<Leaf className="h-4 w-4 text-primary" />
				</div>
				<CardDescription className="text-xs sm:text-sm">
					What sharing instead of buying has added up to
				</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading || !data ? (
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="h-[76px] animate-pulse rounded-lg bg-muted/40" />
						))}
					</div>
				) : (
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<Metric
							icon={<DollarSign className="h-3.5 w-3.5" />}
							label="Money saved"
							value={`$${data.moneySavedUsd.toLocaleString()}`}
						/>
						<Metric
							icon={<Leaf className="h-3.5 w-3.5" />}
							label="CO₂ avoided"
							value={`${data.co2AvoidedKg.toLocaleString()} kg`}
						/>
						<Metric
							icon={<HandshakeIcon className="h-3.5 w-3.5" />}
							label="Times borrowed"
							value={data.timesBorrowed.toLocaleString()}
						/>
						<Metric
							icon={<Package className="h-3.5 w-3.5" />}
							label="Items shared"
							value={data.itemsShared.toLocaleString()}
						/>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
