'use client';

import { useState } from 'react';
import { Send, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const mockConversations = [
	{
		id: 1,
		itemTitle: 'Tent',
		otherUser: { name: 'Mike', avatar: 'M' },
		lastMessage: 'Can I borrow it this weekend?',
		timestamp: '2 hours ago',
		unread: true,
	},
	{
		id: 2,
		itemTitle: 'Projector',
		otherUser: { name: 'Sarah', avatar: 'S' },
		lastMessage: 'Thanks for lending it!',
		timestamp: '5 hours ago',
		unread: false,
	},
	{
		id: 3,
		itemTitle: 'Bike Rack',
		otherUser: { name: 'Emma', avatar: 'E' },
		lastMessage: 'I can pick it up tomorrow',
		timestamp: '1 day ago',
		unread: false,
	},
];

const mockMessages = [
	{
		id: 1,
		sender: 'Mike',
		content: 'Hi! I saw you have a tent available',
		timestamp: '10:30 AM',
		isOwn: false,
	},
	{ id: 2, sender: 'You', content: 'Yes! Do you need it?', timestamp: '10:31 AM', isOwn: true },
	{
		id: 3,
		sender: 'Mike',
		content: 'Can I borrow it this weekend?',
		timestamp: '10:32 AM',
		isOwn: false,
	},
];

export function MessagesPage() {
	const [selectedConversation, setSelectedConversation] = useState(mockConversations[0]);
	const [messageText, setMessageText] = useState('');

	return (
		<div className="flex h-full bg-background">
			{/* Conversations Sidebar */}
			<div className="w-80 border-r border-border flex flex-col bg-card">
				<div className="p-4 border-b border-border">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
						<Input placeholder="Search conversations..." className="pl-10" />
					</div>
				</div>

				<div className="flex-1 overflow-auto">
					{mockConversations.map(conv => (
						<button
							key={conv.id}
							onClick={() => setSelectedConversation(conv)}
							className={`w-full text-left p-4 border-b border-border transition-colors hover:bg-muted ${
								selectedConversation.id === conv.id ? 'bg-accent/10' : ''
							}`}
						>
							<div className="flex items-start gap-3">
								<Avatar className="w-10 h-10 flex-shrink-0">
									<AvatarFallback className="bg-primary text-primary-foreground text-sm">
										{conv.otherUser.avatar}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 min-w-0">
									<p className="font-semibold text-sm text-foreground">{conv.otherUser.name}</p>
									<p className="text-xs text-muted-foreground">{conv.itemTitle}</p>
									<p
										className={`text-xs mt-1 truncate ${
											conv.unread ? 'text-foreground font-medium' : 'text-muted-foreground'
										}`}
									>
										{conv.lastMessage}
									</p>
								</div>
								<span className="text-xs text-muted-foreground flex-shrink-0">{conv.timestamp}</span>
							</div>
						</button>
					))}
				</div>
			</div>

			{/* Chat Window */}
			<div className="flex-1 flex flex-col">
				{/* Chat Header */}
				<div className="border-b border-border p-4 bg-card">
					<div className="flex items-center gap-3">
						<Avatar className="w-10 h-10">
							<AvatarFallback className="bg-primary text-primary-foreground">
								{selectedConversation.otherUser.avatar}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="font-semibold text-foreground">{selectedConversation.otherUser.name}</p>
							<p className="text-sm text-muted-foreground">{selectedConversation.itemTitle}</p>
						</div>
					</div>
				</div>

				{/* Messages */}
				<div className="flex-1 overflow-auto p-4 space-y-4">
					{mockMessages.map(msg => (
						<div key={msg.id} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
							<div
								className={`max-w-xs px-4 py-2 rounded-lg ${
									msg.isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
								}`}
							>
								<p className="text-sm">{msg.content}</p>
								<p className="text-xs opacity-70 mt-1">{msg.timestamp}</p>
							</div>
						</div>
					))}
				</div>

				{/* Input */}
				<div className="border-t border-border p-4 bg-card">
					<div className="flex gap-2">
						<Input
							placeholder="Type a message..."
							value={messageText}
							onChange={e => setMessageText(e.target.value)}
						/>
						<Button className="gap-2">
							<Send className="w-4 h-4" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
