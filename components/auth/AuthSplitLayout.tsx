import type React from 'react';

import Image from 'next/image';

const MARKETING_URL = 'https://circularimpact.org/sharecircle';

type AuthSplitLayoutProps = {
	leftTitle: string;
	leftDescription: string;
	rightHeader?: React.ReactNode;
	children: React.ReactNode;
};

export default function AuthSplitLayout({ leftTitle, leftDescription, rightHeader, children }: AuthSplitLayoutProps) {
	return (
		<div className="min-h-[100dvh] flex">
			{/* Left side - Branding */}
			<div className="relative hidden overflow-hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-emerald-950 items-center justify-center p-8">
				{/* Ambient shapes — decorative only */}
				<div aria-hidden className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
				<div
					aria-hidden
					className="absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-emerald-300/10 blur-3xl"
				/>
				<div className="relative max-w-md">
					<div className="flex items-center gap-3 mb-8">
						<a
							href={MARKETING_URL}
							className="inline-flex rounded-xl transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
							aria-label="ShareCircle — learn more on circularimpact.org"
						>
							<Image
								src="/logo_new_removeBg.png"
								alt="ShareCircle"
								width={200}
								height={80}
								className="h-auto w-48 object-contain"
							/>
						</a>
					</div>
					<h2 className="text-4xl font-display font-bold text-primary-foreground mb-4">{leftTitle}</h2>
					<p className="text-primary-foreground/80 text-lg">{leftDescription}</p>
					<a
						href="https://circularimpact.org"
						className="mt-10 inline-block text-sm text-primary-foreground/60 underline-offset-4 transition-colors hover:text-primary-foreground hover:underline"
					>
						A Circular Impact Network initiative
					</a>
				</div>
			</div>

			{/* Right side - Content */}
			<div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
				<div className="w-full max-w-md">
					<div className="lg:hidden flex justify-center mb-6">
						<a href={MARKETING_URL} aria-label="ShareCircle — learn more on circularimpact.org">
							<Image
								src="/logo_new_removeBg.png"
								alt="ShareCircle"
								width={160}
								height={48}
								className="h-auto w-40 object-contain"
								priority
							/>
						</a>
					</div>
					{rightHeader}
					{children}
				</div>
			</div>
		</div>
	);
}
