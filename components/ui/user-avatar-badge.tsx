import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarBadgeProps {
	user: { name?: string | null; image?: string | null } | null | undefined;
	size?: 'xs' | 'sm' | 'md';
	label?: string;
	className?: string;
}

const sizeClasses = {
	xs: { avatar: 'h-4 w-4', fallback: 'text-[8px]' },
	sm: { avatar: 'h-5 w-5', fallback: 'text-[10px]' },
	md: { avatar: 'h-6 w-6', fallback: 'text-xs' },
};

export function UserAvatarBadge({ user, size = 'sm', label, className }: UserAvatarBadgeProps) {
	const s = sizeClasses[size];
	return (
		<div className={cn('flex items-center gap-2', className)}>
			{label && <span>{label}</span>}
			<Avatar className={s.avatar}>
				<AvatarImage src={user?.image || undefined} />
				<AvatarFallback className={s.fallback}>
					{user?.name?.[0]?.toUpperCase() || '?'}
				</AvatarFallback>
			</Avatar>
			<span className="truncate">{user?.name || 'Unknown'}</span>
		</div>
	);
}
