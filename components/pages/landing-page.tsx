import Link from 'next/link';
import Image from 'next/image';
import {
	ArrowRight,
	Users,
	Search,
	MessageCircle,
	ListOrdered,
	Camera,
	Repeat,
	PackageCheck,
	Leaf,
	ShieldCheck,
} from 'lucide-react';

// Marketing landing page — warm, editorial "neighborhood field-guide" aesthetic.
// Intentionally theme-independent (forced light): it hardcodes its own warm palette
// instead of the app's theme tokens, so it always renders the same regardless of the
// visitor's saved light/dark preference. Pure server component; motion is CSS-only.
//
// Rendered at the site root ("/"). When the visitor already has a session, the
// auth CTAs (Log in / Get started) collapse into a single "Open ShareCircle" link
// to /home — otherwise a signed-in user would see sign-up prompts on their own
// homepage (and clicking them just bounces back via middleware anyway).

const STEPS = [
	{
		n: '01',
		title: 'Gather your circle',
		body: 'Invite the people you already trust — your street, your building, your group chat. Circles are private and invite-only.',
		Icon: Users,
	},
	{
		n: '02',
		title: 'List what you’ll share',
		body: 'Snap a photo of the drill, the tent, the stand mixer. We fill in the name and details so you don’t have to.',
		Icon: Camera,
	},
	{
		n: '03',
		title: 'Borrow & lend',
		body: 'Ask, get a yes, arrange the handoff. Every borrow is tracked end to end — no “who has my ladder?” mysteries.',
		Icon: Repeat,
	},
	{
		n: '04',
		title: 'Pass it back',
		body: 'Mark it returned, both of you confirm, done. The item frees up for the next person in the circle.',
		Icon: PackageCheck,
	},
];

const FEATURES = [
	{
		Icon: Users,
		title: 'Trust circles',
		body: 'Nothing is public. Each item is visible only to the circles you choose to share it with — family, neighbours, your climbing crew.',
		span: 'lg:col-span-3',
	},
	{
		Icon: Search,
		title: 'Search like you talk',
		body: 'Type “something to cut a branch” and find the neighbour’s pruning saw — even if nobody called it that.',
		span: 'lg:col-span-2',
	},
	{
		Icon: MessageCircle,
		title: 'Sort it out in chat',
		body: 'Agree on pickup times without swapping phone numbers.',
		span: 'lg:col-span-2',
	},
	{
		Icon: ListOrdered,
		title: 'Never miss your turn',
		body: 'Item already out? Join the queue and get pinged the moment it’s free.',
		span: 'lg:col-span-3',
	},
];

const FAQS = [
	{
		q: 'Is ShareCircle free?',
		a: 'Yes. ShareCircle is free to use — it’s built around sharing what you already own, not buying or selling.',
	},
	{
		q: 'Who can see my things?',
		a: 'Only the circles you add an item to. There’s no public marketplace — if you don’t share an item with a circle, no one sees it.',
	},
	{
		q: 'How do I know I’ll get my stuff back?',
		a: 'You only lend to people you’ve invited into a circle, and every borrow is tracked: you both confirm the handoff, the due date, and the return.',
	},
	{
		q: 'What kinds of things can I share?',
		a: 'Anything you’d happily lend a friend — power tools, camping gear, kitchen gadgets, board games, books, a projector for movie night.',
	},
	{
		q: 'Do I have to lend things to borrow them?',
		a: 'No. But circles work best when people both give and take, so there’s usually something worth borrowing nearby.',
	},
];

export function LandingPage({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
	return (
		<div className="lp relative min-h-[100dvh] overflow-x-hidden">
			<style>{`
				.lp {
					--paper:#FBF6EC; --paper-2:#F4ECDC; --ink:#1E2A22; --ink-soft:#586458;
					--green:#34a85a; --green-deep:#15793D; --clay:#CB6B3F; --clay-soft:#F0D4BE; --border:#E7DCC7;
					background:var(--paper); color:var(--ink);
					font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
					scroll-behavior:smooth;
				}
				.lp-display { font-family: var(--font-display), 'Poppins', ui-sans-serif, sans-serif; letter-spacing:-0.02em; }
				.lp-muted { color:var(--ink-soft); }
				.lp-eyebrow { color:var(--green-deep); letter-spacing:0.2em; }
				.lp-accent { color:var(--clay); }
				.lp-surface { background:#FFFCF6; border:1px solid var(--border); }
				.lp-paper2 { background:var(--paper-2); }
				.lp-chip { background:#FFFCF6; border:1px solid var(--border); }
				.lp-btn-primary { background:var(--green-deep); color:#fff; transition:transform .18s ease, background-color .18s ease, box-shadow .18s ease; }
				.lp-btn-primary:hover { background:#11622f; transform:translateY(-1px); box-shadow:0 10px 24px -12px rgba(21,121,61,.7); }
				.lp-btn-ghost { color:var(--ink); border:1px solid var(--border); background:#FFFCF6; transition:transform .18s ease, border-color .18s ease; }
				.lp-btn-ghost:hover { border-color:var(--green); transform:translateY(-1px); }
				.lp-link-underline { background-image:linear-gradient(var(--clay),var(--clay)); background-size:100% 2px; background-position:0 100%; background-repeat:no-repeat; }
				.lp-card { transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
				.lp-card:hover { transform:translateY(-3px); box-shadow:0 18px 40px -24px rgba(30,42,34,.45); border-color:var(--green); }
				.lp-grain::before {
					content:""; position:absolute; inset:0; pointer-events:none; z-index:0; opacity:.5;
					background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
				}
				@keyframes lpRise { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
				.lp-rise { opacity:0; animation:lpRise .7s cubic-bezier(.2,.7,.2,1) forwards; }
				@keyframes lpFloat { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-10px) } }
				.lp-float { animation:lpFloat 7s ease-in-out infinite; }
				@media (prefers-reduced-motion: reduce) {
					.lp { scroll-behavior:auto; }
					.lp-rise { animation:none; opacity:1; transform:none; }
					.lp-float { animation:none; }
				}
			`}</style>

			{/* Decorative atmosphere */}
			<div aria-hidden className="lp-grain pointer-events-none absolute inset-0" />
			<div
				aria-hidden
				className="pointer-events-none absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
				style={{ background: 'radial-gradient(closest-side, rgba(52,168,90,.22), transparent)' }}
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute top-[42rem] -left-32 h-[26rem] w-[26rem] rounded-full blur-3xl"
				style={{ background: 'radial-gradient(closest-side, rgba(203,107,63,.16), transparent)' }}
			/>

			<div className="relative z-10">
				{/* Navigation */}
				<nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
					<Link href="/" aria-label="ShareCircle home">
						<Image
							src="/logo_new_removeBg.png"
							alt="ShareCircle"
							width={160}
							height={48}
							className="h-auto w-32 object-contain sm:w-36"
							priority
						/>
					</Link>
					<div className="flex items-center gap-2 sm:gap-3">
						{isAuthenticated ? (
							<Link
								href="/home"
								className="lp-btn-primary inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold sm:px-5"
							>
								Open ShareCircle
							</Link>
						) : (
							<>
								<Link
									href="/login"
									className="rounded-full px-4 py-2 text-sm font-semibold lp-muted transition-colors hover:text-[color:var(--ink)]"
								>
									Log in
								</Link>
								<Link
									href="/signup"
									className="lp-btn-primary inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold sm:px-5"
								>
									Get started
								</Link>
							</>
						)}
					</div>
				</nav>

				{/* Hero */}
				<section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-10 pb-16 sm:px-8 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pt-20">
					<div>
						<p
							className="lp-eyebrow lp-rise text-xs font-bold uppercase sm:text-sm"
							style={{ animationDelay: '0ms' }}
						>
							Borrow more · buy less
						</p>
						<h1
							className="lp-display lp-rise mt-5 text-[2.7rem] font-bold leading-[1.02] sm:text-6xl lg:text-[4.25rem]"
							style={{ animationDelay: '80ms' }}
						>
							Stop buying things
							<br />
							you’ll <span className="lp-accent lp-link-underline">use twice</span>.
						</h1>
						<p
							className="lp-muted lp-rise mt-6 max-w-xl text-lg leading-relaxed sm:text-xl"
							style={{ animationDelay: '160ms' }}
						>
							The drill, the tent, the stand mixer — they’re probably sitting in a cupboard down the
							street. Borrow from circles of people you actually trust, save your money, and waste a
							whole lot less.
						</p>
						<div className="lp-rise mt-9 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: '240ms' }}>
							<Link
								href={isAuthenticated ? '/home' : '/signup'}
								className="lp-btn-primary inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold"
							>
								{isAuthenticated ? 'Go to your dashboard' : 'Start a circle — free'}
								<ArrowRight className="h-4 w-4" />
							</Link>
							<Link
								href="#how-it-works"
								className="lp-btn-ghost inline-flex items-center justify-center rounded-full px-7 py-3.5 text-base font-semibold"
							>
								See how it works
							</Link>
						</div>
						<div className="lp-rise mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm lp-muted" style={{ animationDelay: '320ms' }}>
							<span className="inline-flex items-center gap-2">
								<ShieldCheck className="h-4 w-4" style={{ color: 'var(--green-deep)' }} />
								Private, invite-only circles
							</span>
							<span className="inline-flex items-center gap-2">
								<Leaf className="h-4 w-4" style={{ color: 'var(--green-deep)' }} />
								Less stuff, less waste
							</span>
						</div>
					</div>

					{/* Editorial item-cluster visual (illustrative, no real data) */}
					<div className="lp-rise relative mx-auto w-full max-w-md lg:max-w-none" style={{ animationDelay: '200ms' }}>
						<div className="lp-surface relative rounded-[2rem] p-6 shadow-[0_30px_60px_-30px_rgba(30,42,34,.45)]">
							<div className="flex items-center justify-between">
								<p className="lp-display text-sm font-semibold">Maple Street Circle</p>
								<span
									className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
									style={{ background: 'var(--paper-2)', color: 'var(--green-deep)' }}
								>
									12 members
								</span>
							</div>
							<div className="mt-5 grid grid-cols-2 gap-3">
								{[
									{ name: 'Cordless drill', who: 'from Aisha', tone: 'var(--green)' },
									{ name: '6-person tent', who: 'from Marco', tone: 'var(--clay)' },
									{ name: 'Step ladder', who: 'available now', tone: 'var(--green)' },
									{ name: 'Stand mixer', who: 'from Priya', tone: 'var(--clay)' },
								].map(item => (
									<div key={item.name} className="lp-chip rounded-2xl p-3.5">
										<div
											className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
											style={{ background: 'color-mix(in srgb, ' + item.tone + ' 16%, transparent)' }}
										>
											<PackageCheck className="h-5 w-5" style={{ color: item.tone }} />
										</div>
										<p className="text-sm font-semibold leading-tight">{item.name}</p>
										<p className="lp-muted mt-0.5 text-xs">{item.who}</p>
									</div>
								))}
							</div>
							<div
								className="lp-float mt-5 flex items-center gap-3 rounded-2xl p-3.5"
								style={{ background: 'var(--paper-2)' }}
							>
								<div
									className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
									style={{ background: 'var(--green-deep)' }}
								>
									<MessageCircle className="h-4 w-4 text-white" />
								</div>
								<p className="text-sm">
									<span className="font-semibold">Marco:</span>{' '}
									<span className="lp-muted">“Tent’s yours for the weekend — porch pickup?”</span>
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Provocation / savings band */}
				<section className="mx-auto max-w-6xl px-5 sm:px-8">
					<div className="lp-paper2 rounded-3xl border border-[color:var(--border)] px-6 py-10 sm:px-12 sm:py-14">
						<p className="lp-display max-w-3xl text-2xl font-semibold leading-snug sm:text-3xl">
							How many things do you own that you’ve used <span className="lp-accent">once</span>?
						</p>
						<p className="lp-muted mt-3 max-w-2xl text-base sm:text-lg">
							A circle turns all those one-time purchases into something you can just{' '}
							<span className="font-semibold text-[color:var(--ink)]">ask for</span> — and turns your own
							idle stuff into something genuinely useful to the people around you.
						</p>
					</div>
				</section>

				{/* How it works */}
				<section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
					<div className="max-w-2xl">
						<p className="lp-eyebrow text-xs font-bold uppercase sm:text-sm">How it works</p>
						<h2 className="lp-display mt-3 text-3xl font-bold leading-tight sm:text-4xl">
							Four steps, then it just becomes a habit.
						</h2>
					</div>
					<ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
						{STEPS.map(step => (
							<li key={step.n} className="relative">
								<div className="flex items-center gap-3">
									<span className="lp-display text-5xl font-bold" style={{ color: 'var(--clay-soft)' }}>
										{step.n}
									</span>
									<span
										className="flex h-10 w-10 items-center justify-center rounded-xl"
										style={{ background: 'color-mix(in srgb, var(--green) 14%, transparent)' }}
									>
										<step.Icon className="h-5 w-5" style={{ color: 'var(--green-deep)' }} />
									</span>
								</div>
								<h3 className="lp-display mt-4 text-lg font-semibold">{step.title}</h3>
								<p className="lp-muted mt-2 text-[15px] leading-relaxed">{step.body}</p>
							</li>
						))}
					</ol>
				</section>

				{/* Features — bento grid */}
				<section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 sm:pb-28">
					<div className="max-w-2xl">
						<p className="lp-eyebrow text-xs font-bold uppercase sm:text-sm">What’s inside</p>
						<h2 className="lp-display mt-3 text-3xl font-bold leading-tight sm:text-4xl">
							Built for lending to people, not strangers.
						</h2>
					</div>
					<div className="mt-10 grid gap-4 lg:grid-cols-5">
						{FEATURES.map(f => (
							<div
								key={f.title}
								className={`lp-surface lp-card rounded-3xl p-7 ${f.span}`}
							>
								<div
									className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
									style={{ background: 'color-mix(in srgb, var(--green) 14%, transparent)' }}
								>
									<f.Icon className="h-6 w-6" style={{ color: 'var(--green-deep)' }} />
								</div>
								<h3 className="lp-display text-xl font-semibold">{f.title}</h3>
								<p className="lp-muted mt-2 text-[15px] leading-relaxed">{f.body}</p>
							</div>
						))}
					</div>
				</section>

				{/* FAQ — native details/summary, no JS */}
				<section className="mx-auto max-w-3xl px-5 pb-20 sm:px-8 sm:pb-28">
					<div className="text-center">
						<p className="lp-eyebrow text-xs font-bold uppercase sm:text-sm">Good questions</p>
						<h2 className="lp-display mt-3 text-3xl font-bold leading-tight sm:text-4xl">
							The things people ask first.
						</h2>
					</div>
					<div className="mt-10 space-y-3">
						{FAQS.map(item => (
							<details key={item.q} className="lp-surface group rounded-2xl px-5 py-4 sm:px-6">
								<summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold sm:text-base">
									{item.q}
									<span
										className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg leading-none transition-transform duration-200 group-open:rotate-45"
										style={{ background: 'var(--paper-2)', color: 'var(--green-deep)' }}
										aria-hidden
									>
										+
									</span>
								</summary>
								<p className="lp-muted mt-3 text-[15px] leading-relaxed">{item.a}</p>
							</details>
						))}
					</div>
				</section>

				{/* Final CTA */}
				<section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 sm:pb-28">
					<div
						className="relative overflow-hidden rounded-[2rem] px-7 py-14 text-center sm:px-12 sm:py-20"
						style={{ background: 'var(--green-deep)' }}
					>
						<div
							aria-hidden
							className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-2xl"
							style={{ background: 'rgba(255,255,255,.12)' }}
						/>
						<h2 className="lp-display relative text-3xl font-bold leading-tight text-white sm:text-[2.75rem]">
							Your next “I’ll just buy one” could be a borrow.
						</h2>
						<p className="relative mx-auto mt-4 max-w-xl text-base text-white/85 sm:text-lg">
							Start a circle with a handful of people you trust. It takes a couple of minutes and costs
							nothing.
						</p>
						<div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
							<Link
								href={isAuthenticated ? '/home' : '/signup'}
								className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5"
								style={{ color: 'var(--green-deep)' }}
							>
								{isAuthenticated ? 'Go to your dashboard' : 'Get started — free'}
								<ArrowRight className="h-4 w-4" />
							</Link>
							{!isAuthenticated && (
								<Link
									href="/login"
									className="inline-flex items-center justify-center rounded-full border border-white/40 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
								>
									I already have an account
								</Link>
							)}
						</div>
					</div>
				</section>

				{/* Footer */}
				<footer className="border-t border-[color:var(--border)]">
					<div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
						<Image
							src="/logo_new_removeBg.png"
							alt="ShareCircle"
							width={140}
							height={42}
							className="h-auto w-32 object-contain"
						/>
						<div className="flex flex-col items-center gap-1.5">
							<p className="lp-muted text-sm">A better way to share. © {new Date().getFullYear()} ShareCircle.</p>
							<div className="flex items-center gap-3 text-sm">
								<Link href="/terms" className="lp-muted transition-colors hover:text-[color:var(--ink)]">
									Terms
								</Link>
								<span className="lp-muted" aria-hidden>
									·
								</span>
								<Link href="/privacy" className="lp-muted transition-colors hover:text-[color:var(--ink)]">
									Privacy
								</Link>
							</div>
						</div>
						<div className="flex items-center gap-5 text-sm font-semibold">
							{isAuthenticated ? (
								<Link href="/home" style={{ color: 'var(--green-deep)' }}>
									Open ShareCircle
								</Link>
							) : (
								<>
									<Link href="/login" className="lp-muted transition-colors hover:text-[color:var(--ink)]">
										Log in
									</Link>
									<Link href="/signup" style={{ color: 'var(--green-deep)' }}>
										Get started
									</Link>
								</>
							)}
						</div>
					</div>
				</footer>
			</div>
		</div>
	);
}
