'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ItemDetailsModal } from '@/components/modals/item-details-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const mockAllItems = [
	{
		id: 1,
		title: 'Camping Tent',
		description: 'Coleman 4-person camping tent, great condition',
		image: '/camping-tent.png',
		postedBy: { name: 'Sarah', avatar: 'S' },
		circle: 'Beach House Friends',
		availability: 'Available',
		tags: ['Camping', 'Outdoor', 'Equipment'],
		category: 'Sports & Outdoors',
	},
	{
		id: 2,
		title: 'Projector',
		description: 'HD portable projector with case and all cables',
		image: '/home-theater-projector.png',
		postedBy: { name: 'Mike', avatar: 'M' },
		circle: 'Hiking Club',
		availability: 'Lent Out',
		tags: ['Electronics', 'Entertainment', 'Projector'],
		category: 'Electronics',
	},
	{
		id: 3,
		title: 'Bike Rack',
		description: 'Roof-mounted bike rack for 2 bikes, fits most vehicles',
		image: '/bike-rack.jpg',
		postedBy: { name: 'Emma', avatar: 'E' },
		circle: 'Neighborhood Circle',
		availability: 'Available',
		tags: ['Car', 'Sports', 'Bikes'],
		category: 'Sports & Outdoors',
	},
	{
		id: 4,
		title: 'Power Drill',
		description: 'Cordless power drill with full battery set and carrying case',
		image: '/power-drill.png',
		postedBy: { name: 'John', avatar: 'J' },
		circle: 'Home Improvement Crew',
		availability: 'Available',
		tags: ['Tools', 'DIY', 'Power Tools'],
		category: 'Tools',
	},
	{
		id: 5,
		title: 'Ladder',
		description: '20-foot aluminum ladder, lightweight and sturdy',
		image: '/leaning-wooden-ladder.png',
		postedBy: { name: 'Alex', avatar: 'A' },
		circle: 'Neighborhood Circle',
		availability: 'Available',
		tags: ['Tools', 'Home', 'Maintenance'],
		category: 'Tools',
	},
	{
		id: 6,
		title: 'Kayak',
		description: 'Single-person sea kayak with paddle and life jacket',
		image: '/single-person-kayak.png',
		postedBy: { name: 'Lisa', avatar: 'L' },
		circle: 'Beach House Friends',
		availability: 'Available',
		tags: ['Water Sports', 'Outdoor', 'Recreation'],
		category: 'Sports & Outdoors',
	},
	{
		id: 7,
		title: 'Party Decorations',
		description: 'Complete set of party decorations - lights, balloons, banners',
		image: '/party-decorations.jpg',
		postedBy: { name: 'Chris', avatar: 'C' },
		circle: 'Party Planning',
		availability: 'Available',
		tags: ['Party', 'Decorations', 'Events'],
		category: 'Events & Party',
	},
	{
		id: 8,
		title: 'Board Games Collection',
		description: '10+ popular board games including Catan, Ticket to Ride, Codenames',
		image: '/diverse-board-game-gathering.png',
		postedBy: { name: 'David', avatar: 'D' },
		circle: 'Book Club',
		availability: 'Available',
		tags: ['Games', 'Entertainment', 'Social'],
		category: 'Entertainment',
	},
];

const categories = ['All Categories', 'Sports & Outdoors', 'Tools', 'Electronics', 'Events & Party', 'Entertainment'];

export function BrowseListingsPage() {
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState('All Categories');
	const [availability, setAvailability] = useState('all');
	const [selectedItem, setSelectedItem] = useState<any>(null);
	const [showFilters, setShowFilters] = useState(false);

	const filteredItems = useMemo(() => {
		return mockAllItems.filter(item => {
			const matchesSearch =
				searchQuery === '' ||
				item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
				item.circle.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;

			const matchesAvailability =
				availability === 'all' ||
				(availability === 'available' && item.availability === 'Available') ||
				(availability === 'lent' && item.availability === 'Lent Out');

			return matchesSearch && matchesCategory && matchesAvailability;
		});
	}, [searchQuery, selectedCategory, availability]);

	const handleResetFilters = () => {
		setSearchQuery('');
		setSelectedCategory('All Categories');
		setAvailability('all');
		setShowFilters(false);
	};

	const activeFiltersCount = [selectedCategory !== 'All Categories' ? 1 : 0, availability !== 'all' ? 1 : 0].reduce(
		(a, b) => a + b,
		0,
	);

	return (
		<div className="p-8 px-6 py-3">
			<div className="mb-8">
				<h1 className="text-4xl font-bold text-foreground mb-2">Browse Items</h1>
				<p className="text-muted-foreground">Discover items shared by your community</p>
			</div>

			{/* Search Bar */}
			<div className="flex gap-2 mb-6">
				<div className="flex-1 relative">
					<Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
					<Input
						placeholder="Search by item name, tags, or circle..."
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
						className="pl-10 transition-colors"
					/>
				</div>
				<Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2">
					<Filter className="w-4 h-4" />
					Filters {activeFiltersCount > 0 && <span className="ml-1">({activeFiltersCount})</span>}
				</Button>
			</div>

			{/* Filters */}
			{showFilters && (
				<div className="bg-card border border-border rounded-lg p-6 mb-6 space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-foreground mb-2">Category</label>
							<Select value={selectedCategory} onValueChange={setSelectedCategory}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{categories.map(cat => (
										<SelectItem key={cat} value={cat}>
											{cat}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="block text-sm font-medium text-foreground mb-2">Availability</label>
							<Select value={availability} onValueChange={setAvailability}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Items</SelectItem>
									<SelectItem value="available">Available Now</SelectItem>
									<SelectItem value="lent">Lent Out</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" onClick={handleResetFilters} className="gap-2 bg-transparent">
							<X className="w-4 h-4" />
							Reset Filters
						</Button>
					</div>
				</div>
			)}

			{/* Results Count */}
			<div className="mb-6">
				<p className="text-sm text-muted-foreground">
					Found <span className="font-semibold text-foreground">{filteredItems.length}</span> item
					{filteredItems.length !== 1 ? 's' : ''}
					{searchQuery && <span> matching "{searchQuery}"</span>}
				</p>
			</div>

			{/* Items Grid */}
			{filteredItems.length === 0 ? (
				<div className="bg-card border border-border rounded-lg p-12 text-center">
					<p className="text-muted-foreground mb-4">No items found matching your search</p>
					<Button variant="outline" onClick={handleResetFilters}>
						Clear Filters
					</Button>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{filteredItems.map(item => (
						<div
							key={item.id}
							onClick={() => setSelectedItem(item)}
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
									<h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors line-clamp-2">
										{item.title}
									</h3>
								</div>
								<p className="text-xs text-muted-foreground mb-2">{item.category}</p>
								<p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.description}</p>

								<div className="flex gap-1 mb-3 flex-wrap">
									{item.tags.slice(0, 2).map(tag => (
										<span
											key={tag}
											className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full"
										>
											{tag}
										</span>
									))}
									{item.tags.length > 2 && (
										<span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
											+{item.tags.length - 2}
										</span>
									)}
								</div>

								<div className="pt-3 border-t border-border space-y-3">
									<div className="flex items-center gap-2">
										<Avatar className="w-6 h-6">
											<AvatarFallback className="text-xs bg-primary text-primary-foreground">
												{item.postedBy.avatar}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1 min-w-0">
											<p className="text-xs font-medium truncate">{item.postedBy.name}</p>
											<p className="text-xs text-muted-foreground truncate">{item.circle}</p>
										</div>
									</div>

									<div className="flex items-center justify-between">
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
						</div>
					))}
				</div>
			)}

			<ItemDetailsModal item={selectedItem} onOpenChange={open => !open && setSelectedItem(null)} />
		</div>
	);
}
