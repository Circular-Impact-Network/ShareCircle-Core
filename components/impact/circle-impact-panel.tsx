'use client';

import { Leaf, DollarSign, HandshakeIcon, Users, Crown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useGetCircleImpactQuery } from '@/lib/redux/api/impactApi';
import { formatMoney } from '@/lib/currency';
import { usePreferences } from '@/app/providers';

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
			<div className="flex items-center gap-1.5 text-muted-foreground">
				{icon}
				<span className="text-xs">{label}</span>
			</div>
			<span className="text-lg font-semibold text-foreground sm:text-xl">{value}</span>
		</div>
	);
}

function initials(name: string | null) {
	if (!name) return 'U';
	return name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);
}

/**
 * Circle-level impact (every member) + per-member breakdown (admins only).
 * Reads /api/circles/[id]/impact, backed by the v_cin_circle_* views.
 */
export function CircleImpactPanel({ circleId }: { circleId: string }) {
	const { data, isLoading } = useGetCircleImpactQuery(circleId);
	const summary = data?.summary;
	const { currency, fxRates } = usePreferences();

	return (
		<Card className="border-border/60">
			<CardHeader className="space-y-1 pb-3">
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="text-base sm:text-lg">Circle impact</CardTitle>
					<Leaf className="h-4 w-4 text-primary" />
				</div>
				<CardDescription className="text-xs sm:text-sm">
					What this circle has saved by sharing instead of buying
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{isLoading ? (
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="h-[72px] animate-pulse rounded-lg bg-muted/40" />
						))}
					</div>
				) : !summary ? (
					<p className="text-sm text-muted-foreground">No impact recorded for this circle yet.</p>
				) : (
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<Metric
							icon={<DollarSign className="h-3.5 w-3.5" />}
							label="Money saved"
							value={formatMoney(summary.borrowerSavingsUsd, currency, fxRates)}
						/>
						<Metric
							icon={<Leaf className="h-3.5 w-3.5" />}
							label="CO₂ avoided"
							value={`${(Math.round(summary.ghgSavedKg * 10) / 10).toLocaleString()} kg`}
						/>
						<Metric
							icon={<HandshakeIcon className="h-3.5 w-3.5" />}
							label="Total borrows"
							value={summary.totalBorrows.toLocaleString()}
						/>
						<Metric
							icon={<Users className="h-3.5 w-3.5" />}
							label="Members sharing"
							value={`${summary.uniqueLenders}/${summary.totalMembers}`}
						/>
					</div>
				)}

				{/* Admin-only per-member breakdown */}
				{data?.isAdmin && data.members.length > 0 && (
					<div className="space-y-2 pt-1">
						<div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
							<Crown className="h-3.5 w-3.5 text-amber-500" />
							Member breakdown (admins only)
						</div>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
										<th className="py-2 pr-2 font-medium">Member</th>
										<th className="px-2 py-2 text-right font-medium">Lends</th>
										<th className="px-2 py-2 text-right font-medium">Borrows</th>
										<th className="px-2 py-2 text-right font-medium">CO₂ (kg)</th>
										<th className="py-2 pl-2 text-right font-medium">Saved</th>
									</tr>
								</thead>
								<tbody>
									{data.members.map(m => (
										<tr key={m.userId} className="border-b border-border/40 last:border-0">
											<td className="py-2 pr-2">
												<div className="flex items-center gap-2">
													<Avatar className="h-6 w-6">
														<AvatarFallback className="text-3xs">
															{initials(m.userName)}
														</AvatarFallback>
													</Avatar>
													<span className="truncate">{m.userName || 'Member'}</span>
													{m.memberRole === 'ADMIN' && (
														<Crown className="h-3 w-3 shrink-0 text-amber-500" />
													)}
												</div>
											</td>
											<td className="px-2 py-2 text-right tabular-nums">{m.lendsInCircle}</td>
											<td className="px-2 py-2 text-right tabular-nums">{m.borrowsInCircle}</td>
											<td className="px-2 py-2 text-right tabular-nums">
												{Math.round(m.ghgSavedKg * 10) / 10}
											</td>
											<td className="py-2 pl-2 text-right tabular-nums">
												{formatMoney(m.savingsUsd, currency, fxRates)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
