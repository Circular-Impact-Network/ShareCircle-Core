'use client';

import { Home, Search, LayoutGrid, MessageSquare, LogOut, Plus, Settings, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks';
import { toggleMobileSidebar, setMobileSidebarOpen } from '@/lib/redux/slices/uiSlice';
import { selectUserImage, selectUserName, selectUserEmail } from '@/lib/redux/selectors/userSelectors';
import { cn } from '@/lib/utils';

interface SidebarProps {
	currentPage: string;
	onPageChange: (page: string) => void;
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
	const router = useRouter();
	const dispatch = useAppDispatch();
	const isMobileSidebarOpen = useAppSelector(state => state.ui.isMobileSidebarOpen);

	// Redux selectors for user data
	const userImage = useAppSelector(selectUserImage);
	const userName = useAppSelector(selectUserName);
	const userEmail = useAppSelector(selectUserEmail);

	const navItems = [
		{ id: 'home', label: 'Home', icon: Home },
		{ id: 'browse', label: 'Browse Items', icon: Search },
		{ id: 'circles', label: 'Circles', icon: LayoutGrid },
		{ id: 'my-listings', label: 'My Listings', icon: Plus },
		{ id: 'messages', label: 'Messages', icon: MessageSquare },
		{ id: 'settings', label: 'Settings', icon: Settings },
	];

	const handleLogout = async () => {
		await signOut({ callbackUrl: '/landing' });
	};

	const getInitials = (name: string) => {
		if (!name) return 'U';
		return name
			.split(' ')
			.map(n => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	};

	const handleNavClick = (pageId: string) => {
		onPageChange(pageId);
		// Close mobile sidebar when navigating
		dispatch(setMobileSidebarOpen(false));
	};

	const SidebarContent = () => (
		<>
			{/* Logo */}
			<div className="p-6 border-b border-border flex items-center justify-between gap-3 px-4 py-3">
				<div className="flex items-center gap-3">
					<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
						<span className="text-primary-foreground font-bold text-sm">SC</span>
					</div>
					<span className="font-display font-semibold text-lg">ShareCircle</span>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="lg:hidden"
					onClick={() => dispatch(setMobileSidebarOpen(false))}
				>
					<X className="h-5 w-5" />
				</Button>
			</div>

			{/* Navigation */}
			<nav className="flex-1 space-y-2 overflow-y-auto p-4">
				{navItems.map(item => {
					const Icon = item.icon;
					const isActive = currentPage === item.id;
					return (
						<Button
							key={item.id}
							type="button"
							variant={isActive ? 'default' : 'ghost'}
							className={cn(
								'w-full justify-start gap-3 px-4 py-3 text-left font-medium transition-colors',
								isActive
									? 'bg-primary text-primary-foreground shadow'
									: 'text-foreground hover:bg-muted',
							)}
							onClick={() => handleNavClick(item.id)}
						>
							<Icon className="h-5 w-5" />
							<span>{item.label}</span>
						</Button>
					);
				})}
			</nav>

			{/* User Profile Section */}
			{(userName || userEmail) && (
				<div className="px-4 py-3 border-t border-border">
					<div className="flex items-center gap-3">
						<Avatar className="w-10 h-10 bg-primary">
							<AvatarImage src={userImage || ''} />
							<AvatarFallback className="bg-primary text-primary-foreground font-semibold leading-[1.6rem]">
								{getInitials(userName || userEmail || 'U')}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium truncate">{userName || userEmail?.split('@')[0]}</p>
							<p className="text-xs text-muted-foreground truncate">{userEmail}</p>
						</div>
						<Button variant="outline" className="gap-2 bg-transparent" onClick={handleLogout}>
							<LogOut className="w-4 h-4" />
						</Button>
					</div>
				</div>
			)}
		</>
	);

	return (
		<>
			{/* Desktop Sidebar */}
			<div className="hidden lg:flex w-64 border-r border-border bg-card flex-col h-screen">
				<SidebarContent />
			</div>

			{/* Mobile Overlay */}
			{isMobileSidebarOpen && (
				<div
					className="fixed inset-0 bg-black/50 z-40 lg:hidden"
					onClick={() => dispatch(setMobileSidebarOpen(false))}
				/>
			)}

			{/* Mobile Sidebar */}
			<div
				className={`fixed inset-y-0 left-0 w-64 border-r border-border bg-card flex flex-col h-screen z-50 transform transition-transform duration-300 lg:hidden ${
					isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
				}`}
			>
				<SidebarContent />
			</div>
		</>
	);
}
