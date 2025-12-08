'use client';

import { Users, FileText, BookMarked, MessageCircle, User, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
	currentPage: string;
	onPageChange: (page: string) => void;
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
	const navItems = [
		{ id: 'circles', label: 'Circles', icon: Users },
		{ id: 'listings', label: 'All Listings', icon: FileText },
		{ id: 'my-listings', label: 'My Listings', icon: BookMarked },
		{ id: 'messages', label: 'Messages', icon: MessageCircle },
		{ id: 'profile', label: 'Profile', icon: User },
	];

	return (
		<aside className="w-64 bg-sidebar border-r border-sidebar-border p-6 flex flex-col gap-8">
			<div className="flex items-center gap-2">
				<div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center hover:shadow-lg transition-all duration-300">
					<Share2 className="w-6 h-6 text-primary-foreground" />
				</div>
				<h1 className="text-xl font-bold text-sidebar-foreground">ShareCircle</h1>
			</div>

			<nav className="flex flex-col gap-2 flex-1">
				{navItems.map(item => {
					const Icon = item.icon;
					const isActive = currentPage === item.id;
					return (
						<button
							key={item.id}
							onClick={() => onPageChange(item.id)}
							className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
								isActive
									? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
									: 'text-sidebar-foreground hover:bg-sidebar-accent/20'
							}`}
						>
							<Icon className="w-5 h-5" />
							<span className="font-medium">{item.label}</span>
						</button>
					);
				})}
			</nav>

			<Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 shadow-md hover:shadow-lg">
				Create Circle
			</Button>
		</aside>
	);
}
