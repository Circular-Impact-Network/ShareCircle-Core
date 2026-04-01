'use client';

import {
	Package,
	Clock,
	Loader2,
	Plus,
	CheckCircle,
	EyeOff,
	MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import type { ItemRequest } from '@/lib/redux/api/borrowApi';

function getStatusLabel(status: string) {
	switch (status) {
		case 'OPEN':
			return 'Open';
		case 'FULFILLED':
			return 'Fulfilled';
		case 'CANCELLED':
			return 'Closed';
		default:
			return status;
	}
}

export function ItemRequestCard({
	request,
	onRespond,
	onIgnore,
	onClose,
	isMyRequest,
	isResponding,
	isClosing,
}: {
	request: ItemRequest;
	onRespond?: (requestId: string, requesterId: string, requestTitle: string) => void;
	onIgnore?: (requestId: string) => void;
	onClose?: (requestId: string) => void;
	isMyRequest: boolean;
	isResponding?: boolean;
	isClosing?: boolean;
}) {
	const isOpen = request.status === 'OPEN';
	const hasDates = !!(request.desiredFrom && request.desiredTo);
	const circleNames = request.circles?.map(entry => entry.circle.name) ?? [];

	return (
		<Card
			className={`${!isOpen ? 'opacity-60' : ''} ${request.isIgnored ? 'opacity-40' : ''}`}
			data-testid="request-card"
			data-status={request.status}
		>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					<div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
						{request.isResponded ? (
							<CheckCircle className="h-5 w-5 text-green-600" />
						) : (
							<Package className="h-5 w-5 text-primary" />
						)}
					</div>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<p className="text-sm font-medium">{request.title}</p>
							<Badge variant={isOpen ? 'default' : request.status === 'FULFILLED' ? 'secondary' : 'outline'}>
								{getStatusLabel(request.status)}
							</Badge>
							{request.isResponded && (
								<Badge variant="secondary" className="gap-1 text-green-700 bg-green-100">
									<CheckCircle className="h-3 w-3" />
									Responded
								</Badge>
							)}
						</div>
						{request.description && (
							<p className="text-sm text-muted-foreground line-clamp-2 mb-2">{request.description}</p>
						)}
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<Avatar className="h-4 w-4">
								<AvatarImage src={request.requester.image || undefined} />
								<AvatarFallback className="text-[8px]">
									{request.requester.name?.[0]?.toUpperCase() || '?'}
								</AvatarFallback>
							</Avatar>
							<span>{request.requester.name || 'Unknown'}</span>
							<span>·</span>
							<span>{circleNames.join(', ') || request.circle?.name || 'Circle'}</span>
							<span>·</span>
							<span>{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}</span>
						</div>
						{hasDates && (
							<p className="text-xs text-muted-foreground mt-1">
								Needed: {new Date(request.desiredFrom!).toLocaleDateString()} -{' '}
								{new Date(request.desiredTo!).toLocaleDateString()}
							</p>
						)}

						{/* Actions for non-owner on open requests */}
						{isOpen && !isMyRequest && (onRespond || onIgnore) && !request.isResponded && (
							<div className="mt-3 flex flex-wrap gap-2">
								{onRespond && (
									<Button
										size="sm"
										variant="outline"
										className="gap-2"
										disabled={isResponding}
										onClick={() => onRespond(request.id, request.requester.id, request.title)}
									>
										{isResponding ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<MessageCircle className="h-4 w-4" />
										)}
										Respond
									</Button>
								)}
								{onIgnore && (
									<Button
										size="sm"
										variant="ghost"
										className="gap-2 text-muted-foreground"
										onClick={() => onIgnore(request.id)}
									>
										<EyeOff className="h-4 w-4" />
										Ignore
									</Button>
								)}
							</div>
						)}

						{/* Actions for owner on open requests */}
						{isOpen && isMyRequest && onClose && (
							<div className="mt-3 flex flex-wrap gap-2">
								<Button
									size="sm"
									variant="outline"
									className="gap-2"
									disabled={isClosing}
									onClick={() => onClose(request.id)}
								>
									{isClosing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
									Close request
								</Button>
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
