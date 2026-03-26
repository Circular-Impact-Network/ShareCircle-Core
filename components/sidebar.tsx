'use client';

import Image from 'next/image';
import { Users, FileText, BookMarked, MessageCircle, User } from 'lucide-react';
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
			<div className="flex items-center">
				<Image
					src="/share-circle-logo.png"
					alt="ShareCircle"
					width={160}
					height={48}
					className="h-auto w-40 object-contain"
					priority
				/>
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
