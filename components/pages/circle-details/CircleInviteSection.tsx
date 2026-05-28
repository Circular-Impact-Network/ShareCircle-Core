'use client';

import { Check, Copy, Link2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type CircleInviteSectionProps = {
	inviteCode: string;
	shareUrl: string;
	expiryLabel: string;
	isAdmin: boolean;
	isRegeneratingCode: boolean;
	copied: 'code' | 'link' | null;
	onCopy: (text: string, type: 'code' | 'link') => void;
	onRegenerate: () => void;
};

export function CircleInviteSection({
	inviteCode,
	shareUrl,
	expiryLabel,
	isAdmin,
	isRegeneratingCode,
	copied,
	onCopy,
	onRegenerate,
}: CircleInviteSectionProps) {
	return (
		<Card className="border-border/70 bg-muted/30">
			<CardContent className="p-4">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
					{/* Invite Code */}
					<div className="flex-1">
						<div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
							<Link2 className="h-3 w-3" />
							Invite Code
						</div>
						<div className="flex items-center gap-2">
							<code className="font-mono text-lg font-bold tracking-widest text-foreground sm:text-xl">
								{inviteCode}
							</code>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								onClick={() => onCopy(inviteCode, 'code')}
							>
								{copied === 'code' ? (
									<Check className="h-4 w-4 text-emerald-500" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</Button>
							{isAdmin && (
								<Button
									variant="ghost"
									size="sm"
									className="h-8 w-8 p-0"
									onClick={onRegenerate}
									disabled={isRegeneratingCode}
								>
									{isRegeneratingCode ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<RefreshCw className="h-4 w-4" />
									)}
								</Button>
							)}
						</div>
					</div>

					<Separator orientation="vertical" className="hidden h-12 sm:block" />
					<Separator className="sm:hidden" />

					{/* Share Link */}
					<div className="flex-1">
						<div className="mb-1 text-xs text-muted-foreground">Share Link</div>
						<div className="flex items-center gap-2">
							<code className="flex-1 truncate rounded bg-muted/50 px-2 py-1 text-sm text-primary">
								{shareUrl}
							</code>
							<Button
								variant="secondary"
								size="sm"
								className="shrink-0 gap-1"
								onClick={() => onCopy(shareUrl, 'link')}
							>
								{copied === 'link' ? (
									<>
										<Check className="h-3 w-3" />
										<span className="hidden sm:inline">Copied</span>
									</>
								) : (
									<>
										<Copy className="h-3 w-3" />
										<span className="hidden sm:inline">Copy</span>
									</>
								)}
							</Button>
						</div>
					</div>
				</div>
				<p className="mt-3 text-xs text-muted-foreground">{expiryLabel}</p>
			</CardContent>
		</Card>
	);
}
