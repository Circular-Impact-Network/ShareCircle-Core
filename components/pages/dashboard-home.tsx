'use client';

import { useEffect, useState } from 'react';
import { Plus, MapPin, Users, TrendingUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageShell } from '@/components/ui/page';

interface DashboardHomeProps {
	onNavigate: (page: string) => void;
}

const activityLog = [
	{ action: 'Borrowed', item: 'Power Drill', from: 'Home Circle', date: '2 days ago' },
	{ action: 'Lent', item: 'Camping Tent', to: 'Alex Smith', date: '1 week ago' },
	{ action: 'Returned', item: 'Ladder', to: 'Neighborhood Circle', date: '2 weeks ago' },
];

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
	const [userName, setUserName] = useState('User');

	useEffect(() => {
		const name = localStorage.getItem('sharecircle_user_name') || 'User';
		setUserName(name.charAt(0).toUpperCase() + name.slice(1));
	}, []);

	const stats = [
		{
			label: 'Active Circles',
			value: '3',
			icon: Users,
		},
		{
			label: 'My Listings',
			value: '5',
			icon: TrendingUp,
		},
		{
			label: 'Items Borrowed',
			value: '2',
			icon: MapPin,
		},
	];

	return (
		<div className="flex-1 bg-background">
			<PageShell className="flex flex-col gap-8">
				<Card className="border-none bg-gradient-to-r from-primary/20 via-primary/10 to-secondary/20 text-primary-foreground shadow-2xl">
					<CardHeader className="space-y-2">
						<CardTitle className="text-3xl font-bold lg:text-4xl">Welcome back, {userName}!</CardTitle>
						<CardDescription className="text-base text-primary-foreground/80">
							Share what you have, borrow what you need
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-wrap gap-3">
						<Button variant="secondary" className="gap-2" onClick={() => onNavigate('my-listings')}>
							<Plus className="h-4 w-4" />
							Create listing
						</Button>
						<Button
							variant="outline"
							className="bg-white/10 text-white hover:bg-white/20"
							onClick={() => onNavigate('browse')}
						>
							Browse items
						</Button>
					</CardContent>
				</Card>

				<div className="grid gap-6 lg:grid-cols-3">
					{stats.map(stat => {
						const Icon = stat.icon;
						return (
							<Card key={stat.label}>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardDescription>{stat.label}</CardDescription>
									<Icon className="h-5 w-5 text-primary" />
								</CardHeader>
								<CardContent>
									<div className="text-3xl font-bold">{stat.value}</div>
								</CardContent>
							</Card>
						);
					})}
				</div>

				<Card className="border-border/60">
					<CardHeader>
						<CardTitle>Recent activity</CardTitle>
						<CardDescription>Track what you&apos;ve shared or borrowed lately</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{activityLog.map((activity, index) => (
							<div key={activity.item} className="space-y-1">
								<div className="flex items-center justify-between text-sm">
									<p className="font-medium text-foreground">
										<span className="text-primary">{activity.action}</span> {activity.item}
									</p>
									<span className="text-xs text-muted-foreground">{activity.date}</span>
								</div>
								<p className="text-xs text-muted-foreground">{activity.from || activity.to}</p>
								{index < activityLog.length - 1 && <Separator className="my-3" />}
							</div>
						))}
					</CardContent>
				</Card>

				<div className="grid gap-4 md:grid-cols-2">
					<Card className="bg-primary text-primary-foreground">
						<CardHeader>
							<CardTitle>Create a new listing</CardTitle>
							<CardDescription className="text-primary-foreground/80">
								Share an item with your trusted circles
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button
								size="lg"
								variant="secondary"
								className="w-full"
								onClick={() => onNavigate('my-listings')}
							>
								<Plus className="mr-2 h-4 w-4" />
								Add listing
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Browse listings</CardTitle>
							<CardDescription>Find something new to borrow today</CardDescription>
						</CardHeader>
						<CardContent>
							<Button variant="outline" className="w-full gap-2" onClick={() => onNavigate('browse')}>
								<Search className="h-4 w-4" />
								Explore items
							</Button>
						</CardContent>
					</Card>
				</div>
			</PageShell>
		</div>
	);
}
