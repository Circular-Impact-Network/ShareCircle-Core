'use client';

import { Package, Clock, Loader2, CheckCircle, EyeOff, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import type { ItemRequest } from '@/lib/redux/api/borrowApi';
import { getItemRequestPresentation } from '@/lib/borrow-ui';

export function ItemRequestCard({
	request,
	onRespond,
	onIgnore,
	onClose,
	onChat,
	isMyRequest,
	isResponding,
	isClosing,
}: {
	request: ItemRequest;
	onRespond?: (requestId: string, requesterId: string, requestTitle: string) => void;
	onIgnore?: (requestId: string) => void;
	onClose?: (requestId: string) => void;
	onChat?: (requesterId: string, requestId: string, requestTitle: string) => void;
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
							{!isOpen &&
								(() => {
									const p = getItemRequestPresentation(request.status);
									return <Badge variant={p.tone === 'secondary' ? 'secondary' : 'outline'}>{p.label}</Badge>;
								})()}
							{request.isResponded && (
								<span
									aria-label="Responded"
									title="Responded"
									data-testid="responded-indicator"
									className="inline-flex items-center justify-center rounded-full bg-green-100 p-0.5 text-green-700"
								>
									<CheckCircle className="h-3.5 w-3.5" />
								</span>
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
										data-testid="respond-btn"
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
										data-testid="ignore-btn"
										onClick={() => onIgnore(request.id)}
									>
										<EyeOff className="h-4 w-4" />
										Ignore
									</Button>
								)}
							</div>
						)}

						{/* Persistent chat affordance after the user has responded */}
						{!isMyRequest && request.isResponded && onChat && (
							<div className="mt-3 flex flex-wrap gap-2">
								<Button
									size="sm"
									variant="outline"
									className="gap-2"
									data-testid="chat-btn"
									onClick={() => onChat(request.requester.id, request.id, request.title)}
								>
									<MessageCircle className="h-4 w-4" />
									Chat
								</Button>
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
									data-testid="close-request-btn"
									onClick={() => onClose(request.id)}
								>
									{isClosing ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Clock className="h-4 w-4" />
									)}
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
