import { Smile, Send } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type MessageComposerProps = {
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	onTyping?: () => void;
	disabled?: boolean;
};

const DEFAULT_EMOJI = ['😀', '😂', '😍', '😎', '👍', '🙏', '🔥', '🎉', '❤️', '🥳'];

export function MessageComposer({ value, onChange, onSend, onTyping, disabled }: MessageComposerProps) {
	const emojis = useMemo(() => DEFAULT_EMOJI, []);

	return (
		<div className="border-t border-border bg-card p-4">
			<div className="flex gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" disabled={disabled}>
							<Smile className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="flex flex-wrap gap-2 p-2">
						{emojis.map(emoji => (
							<DropdownMenuItem
								key={emoji}
								className="text-lg"
								onClick={() => onChange(`${value}${emoji}`)}
							>
								{emoji}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
				<Input
					placeholder={disabled ? 'Chat disabled' : 'Type a message...'}
					value={value}
					onChange={event => {
						onChange(event.target.value);
						onTyping?.();
					}}
					onKeyDown={event => {
						if (event.key === 'Enter' && !event.shiftKey) {
							event.preventDefault();
							onSend();
						}
					}}
					disabled={disabled}
				/>
				<Button className="gap-2" onClick={onSend} disabled={disabled || !value.trim()}>
					<Send className="h-4 w-4" />
					Send
				</Button>
			</div>
		</div>
	);
}
