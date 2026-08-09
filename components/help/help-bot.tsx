'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Compass, LifeBuoy, Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { startTourManually } from '@/components/tour/app-tour';

type Turn = { role: 'user' | 'assistant'; content: string };

/** Dispatched on `window` to open the assistant panel from elsewhere in the app. */
export const HELP_BOT_OPEN_EVENT = 'sharecircle:open-help-bot';
export const HELP_BOT_CLOSE_EVENT = 'sharecircle:close-help-bot';

const SUGGESTIONS = ['How do I borrow an item?', 'How do invite codes work?', 'Why can nobody see my item?'];

/**
 * Floating help assistant, available on every authenticated screen.
 *
 * It answers from a fixed body of product knowledge and has no access to the user's account, so it
 * can explain where to find a borrow request but never what is in one. The only thing it is told
 * about the person asking is whether they are on a phone or a computer, which is what lets it name
 * the right navigation instead of describing a sidebar to someone holding a phone.
 */
export function HelpBot() {
	const [open, setOpen] = useState(false);
	const [turns, setTurns] = useState<Turn[]>([]);
	const [draft, setDraft] = useState('');
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	// The guided tour opens the panel for its closing step, so that step can highlight a control
	// that only exists once the panel is on screen. An event rather than a shared store: the two
	// features are otherwise unrelated, and a store would tie them together for one message.
	useEffect(() => {
		const open = () => setOpen(true);
		// And closed again when the tour ends, because the tour is what opened it. Left open, it sat
		// underneath the push permission card that appears next — same corner, higher z-index —
		// which covered the two buttons the tour's last step had just pointed at.
		const close = () => setOpen(false);
		window.addEventListener(HELP_BOT_OPEN_EVENT, open);
		window.addEventListener(HELP_BOT_CLOSE_EVENT, close);
		return () => {
			window.removeEventListener(HELP_BOT_OPEN_EVENT, open);
			window.removeEventListener(HELP_BOT_CLOSE_EVENT, close);
		};
	}, []);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
	}, [turns, pending]);

	const ask = async (question: string) => {
		const trimmed = question.trim();
		if (!trimmed || pending) {
			return;
		}

		setDraft('');
		setError(null);
		setPending(true);
		// The question is shown immediately; the answer is appended as it streams in.
		const history = turns.slice(-12);
		setTurns(current => [...current, { role: 'user', content: trimmed }]);

		try {
			const res = await fetch('/api/help-chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					message: trimmed,
					history,
					platform: window.matchMedia('(min-width: 1024px)').matches ? 'desktop' : 'mobile',
				}),
			});

			if (!res.ok) {
				const detail = (await res.json().catch(() => null)) as { error?: string } | null;
				// The 429 body carries the quota message, which is worth showing verbatim: "you have
				// reached today's limit" is actionable in a way that "something went wrong" is not.
				throw new Error(detail?.error ?? 'The assistant is unavailable right now.');
			}

			const reader = res.body?.getReader();
			if (!reader) {
				throw new Error('The assistant returned nothing.');
			}

			const decoder = new TextDecoder();
			let answer = '';
			setTurns(current => [...current, { role: 'assistant', content: '' }]);

			for (;;) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}
				answer += decoder.decode(value, { stream: true });
				setTurns(current => {
					const next = [...current];
					next[next.length - 1] = { role: 'assistant', content: answer };
					return next;
				});
			}

			// A generation failure does not reach the `catch` below. The AI SDK's text stream carries
			// only text parts, so an upstream error — a bad API key, a safety refusal, a 5xx from
			// Gemini — is dropped from the stream and the response still closes cleanly with a 200.
			// The read loop simply ends having produced nothing, which showed the user a blank grey
			// bubble and no explanation, while every silent failure still spent their hourly quota.
			if (!answer.trim()) {
				throw new Error('The assistant could not answer that just now. Please try again.');
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'Something went wrong.');
			// Drop the empty assistant bubble so a failure does not leave a blank reply on screen.
			setTurns(current =>
				current.at(-1)?.role === 'assistant' && !current.at(-1)?.content ? current.slice(0, -1) : current,
			);
		} finally {
			setPending(false);
		}
	};

	if (!open) {
		return (
			<button
				type="button"
				data-testid="help-bot-launcher"
				data-tour="help-bot"
				onClick={() => setOpen(true)}
				aria-label="Open help assistant"
				// Lifted clear of the bottom navigation on a phone, where it would otherwise sit on top
				// of the Alerts tab.
				className="fixed right-4 bottom-[calc(var(--bottom-nav-height,4rem)+1rem)] z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none lg:right-6 lg:bottom-6"
			>
				<Bot className="h-5 w-5" />
			</button>
		);
	}

	return (
		<div
			data-testid="help-bot-panel"
			role="dialog"
			aria-label="Help assistant"
			className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-height,4rem)+1rem)] z-40 flex max-h-[70dvh] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl lg:inset-x-auto lg:right-6 lg:bottom-6 lg:h-[32rem] lg:w-96"
		>
			<header className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
				<div className="flex items-center gap-2">
					<Bot className="h-4 w-4 text-primary" />
					<span className="text-sm font-medium">ShareCircle help</span>
				</div>
				<button
					type="button"
					onClick={() => setOpen(false)}
					aria-label="Close help assistant"
					className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<X className="h-4 w-4" />
				</button>
			</header>

			<div ref={scrollRef} className="app-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
				{turns.length === 0 && (
					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">
							Ask me anything about using ShareCircle. I can explain how borrowing, circles and
							notifications work.
						</p>
						<div className="flex flex-wrap gap-2">
							{SUGGESTIONS.map(suggestion => (
								<button
									key={suggestion}
									type="button"
									onClick={() => void ask(suggestion)}
									className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								>
									{suggestion}
								</button>
							))}
						</div>
					</div>
				)}

				{turns.map((turn, index) => (
					<div
						key={index}
						data-testid={`help-bot-${turn.role}`}
						className={
							turn.role === 'user'
								? 'ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
								: 'w-fit max-w-[90%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap'
						}
					>
						{turn.content}
					</div>
				))}

				{pending && turns.at(-1)?.role === 'user' && (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						Thinking…
					</div>
				)}

				{error && (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}
			</div>

			<footer className="shrink-0 space-y-2 border-t border-border/60 px-4 py-3">
				<form
					onSubmit={event => {
						event.preventDefault();
						void ask(draft);
					}}
					className="flex items-center gap-2"
				>
					<Input
						value={draft}
						onChange={event => setDraft(event.target.value)}
						placeholder="Ask a question…"
						aria-label="Ask a question"
						data-testid="help-bot-input"
						maxLength={1000}
						className="h-9"
					/>
					<Button type="submit" size="sm" disabled={pending || !draft.trim()} aria-label="Send">
						<Send className="h-4 w-4" />
					</Button>
				</form>
				{/* Two real buttons rather than a text link. These are the things a stuck user wants
				    and neither was reachable without knowing where to look: the guide was a
				    footnote, and replaying the tour was buried three levels into Settings. */}
				<div className="grid grid-cols-2 gap-2">
					<Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
						<a href="/api/docs/help" target="_blank" rel="noopener noreferrer">
							<LifeBuoy className="h-3.5 w-3.5" />
							Help guide
						</a>
					</Button>
					<Button
						variant="outline"
						size="sm"
						data-tour="replay-tour"
						data-testid="help-bot-replay-tour"
						className="h-8 gap-1.5 text-xs"
						onClick={() => {
							setOpen(false);
							// The panel covers the elements the tour highlights, so it closes first.
							window.setTimeout(() => startTourManually(), 150);
						}}
					>
						<Compass className="h-3.5 w-3.5" />
						Replay tour
					</Button>
				</div>
			</footer>
		</div>
	);
}
