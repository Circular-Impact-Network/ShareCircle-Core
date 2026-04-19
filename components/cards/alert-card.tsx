'use client';

import {
	Bell,
	Check,
	CheckCircle2,
	Clock,
	HandshakeIcon,
	Loader2,
	MessageSquare,
	Package,
	RotateCcw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/redux/api/notificationsApi';

function NotificationIconGlyph({ type, className }: { type: string; className?: string }) {
	switch (type) {
		case 'ITEM_REQUEST_CREATED':
		case 'ITEM_REQUEST_FULFILLED':
			return <Package className={className} />;
		case 'BORROW_REQUEST_RECEIVED':
		case 'BORROW_REQUEST_APPROVED':
		case 'BORROW_REQUEST_DECLINED':
			return <HandshakeIcon className={className} />;
		case 'QUEUE_POSITION_UPDATED':
		case 'QUEUE_ITEM_READY':
			return <Clock className={className} />;
		case 'ITEM_HANDOFF_CONFIRMED':
		case 'ITEM_RECEIVED_CONFIRMED':
		case 'RETURN_REQUESTED':
		case 'RETURN_CONFIRMED':
			return <RotateCcw className={className} />;
		case 'NEW_MESSAGE':
			return <MessageSquare className={className} />;
		default:
			return <Bell className={className} />;
	}
}

interface AlertCardProps {
	notification: Notification;
	onMarkRead: (id: string) => void;
	onNavigate: (notification: Notification) => void;
	actionLabel?: string;
	onAction?: () => void;
	isActionLoading?: boolean;
	actionDoneLabel?: string;
}

export function AlertCard({
	notification,
	onMarkRead,
	onNavigate,
	actionLabel,
	onAction,
	isActionLoading,
	actionDoneLabel,
}: AlertCardProps) {
	const isUnread = notification.status === 'UNREAD';

	const handleClick = () => {
		if (isUnread) {
			onMarkRead(notification.id);
		}
		onNavigate(notification);
	};

	const handleAction = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isUnread) onMarkRead(notification.id);
		onAction?.();
	};

	return (
		<Card
			className={cn(
				'cursor-pointer transition-all hover:bg-accent/50',
				isUnread && 'border-primary/30 bg-primary/5',
			)}
			onClick={handleClick}
		>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					<div
						className={cn(
							'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
							isUnread ? 'bg-primary/10' : 'bg-muted',
						)}
					>
						<NotificationIconGlyph
							type={notification.type}
							className={cn('h-5 w-5', isUnread ? 'text-primary' : 'text-muted-foreground')}
						/>
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<p className={cn('text-sm font-medium', isUnread && 'text-foreground')}>
								{notification.title}
							</p>
							{isUnread && <div className="h-2 w-2 rounded-full bg-primary" />}
						</div>
						<p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{notification.body}</p>
						<p className="mt-1 text-xs text-muted-foreground">
							{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
						</p>
						{actionDoneLabel ? (
							<div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
								<CheckCircle2 className="h-3.5 w-3.5" />
								{actionDoneLabel}
							</div>
						) : actionLabel && onAction ? (
							<div className="mt-3">
								<Button size="sm" className="gap-2" onClick={handleAction} disabled={isActionLoading}>
									{isActionLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Check className="h-4 w-4" />
									)}
									{actionLabel}
								</Button>
							</div>
						) : null}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
