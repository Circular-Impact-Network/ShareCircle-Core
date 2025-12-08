'use client';

import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const mockListings = [
	{
		id: 1,
		title: 'Camping Tent',
		circle: 'Beach House Friends',
		postedBy: { name: 'Sarah', avatar: 'S' },
		image: '/camping-tent.png',
		availability: 'Available',
	},
	{
		id: 2,
		title: 'Board Games',
		circle: 'Book Club',
		postedBy: { name: 'Emma', avatar: 'E' },
		image: '/diverse-board-game-gathering.png',
		availability: 'Available',
	},
	{
		id: 3,
		title: 'Hiking Backpack',
		circle: 'Hiking Club',
		postedBy: { name: 'Mike', avatar: 'M' },
		image: '/hiking-backpack.png',
		availability: 'Lent Out',
	},
	{
		id: 4,
		title: 'Party Decorations',
		circle: 'Party Planning',
		postedBy: { name: 'Alex', avatar: 'A' },
		image: '/party-decorations.jpg',
		availability: 'Available',
	},
	{
		id: 5,
		title: 'Projector',
		circle: 'Beach House Friends',
		postedBy: { name: 'John', avatar: 'J' },
		image: '/home-theater-projector.png',
		availability: 'Available',
	},
	{
		id: 6,
		title: 'Kayak',
		circle: 'Hiking Club',
		postedBy: { name: 'Lisa', avatar: 'L' },
		image: '/single-person-kayak.png',
		availability: 'Available',
	},
];

interface AllListingsPageProps {
	onNavigate?: (page: string) => void;
}

export function AllListingsPage({ onNavigate }: AllListingsPageProps) {
	const [searchTerm, setSearchTerm] = useState('');

	const filteredListings = mockListings.filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()));

	return (
		<div className="p-8">
			<h1 className="text-4xl font-bold text-foreground mb-2">All Listings</h1>
			<p className="text-muted-foreground mb-8">Browse items from all your circles</p>

			<div className="flex gap-4 mb-8">
				<div className="flex-1 relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
					<Input
						placeholder="Search items..."
						value={searchTerm}
						onChange={e => setSearchTerm(e.target.value)}
						className="pl-10"
					/>
				</div>
				<Button variant="outline" className="gap-2 bg-transparent">
					<Filter className="w-4 h-4" />
					Filters
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{filteredListings.map(item => (
					<div
						key={item.id}
						className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
					>
						<div className="h-40 bg-muted overflow-hidden">
							<img
								src={item.image || '/placeholder.svg'}
								alt={item.title}
								className="w-full h-full object-cover group-hover:scale-105 transition-transform"
							/>
						</div>
						<div className="p-4">
							<div className="flex items-start justify-between mb-2">
								<h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
									{item.title}
								</h3>
							</div>
							<p className="text-xs text-muted-foreground mb-3">{item.circle}</p>
							<div className="flex items-center justify-between pt-3 border-t border-border">
								<div className="flex items-center gap-2">
									<Avatar className="w-6 h-6">
										<AvatarFallback className="text-xs bg-primary text-primary-foreground">
											{item.postedBy.avatar}
										</AvatarFallback>
									</Avatar>
									<span className="text-sm text-muted-foreground">{item.postedBy.name}</span>
								</div>
								<span
									className={`text-xs font-medium px-2 py-1 rounded ${
										item.availability === 'Available'
											? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
											: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
									}`}
								>
									{item.availability}
								</span>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
