import type React from 'react';

import { Share2 } from 'lucide-react';

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
			<div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/60 items-center justify-center p-8">
				<div className="max-w-md">
					<div className="flex items-center gap-3 mb-8">
						<div className="w-10 h-10 bg-primary-foreground rounded-lg flex items-center justify-center">
							<Share2 className="w-6 h-6 text-primary" />
						</div>
						<span className="font-display font-bold text-2xl text-primary-foreground">ShareCircle</span>
					</div>
					<h2 className="text-4xl font-display font-bold text-primary-foreground mb-4">{leftTitle}</h2>
					<p className="text-primary-foreground/80 text-lg">{leftDescription}</p>
				</div>
			</div>

			{/* Right side - Content */}
			<div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
				<div className="w-full max-w-md">
					<div className="lg:hidden flex items-center gap-2 mb-6">
						<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
							<Share2 className="w-5 h-5 text-primary-foreground" />
						</div>
						<span className="font-display font-semibold text-lg">ShareCircle</span>
					</div>
					{rightHeader}
					{children}
				</div>
			</div>
		</div>
	);
}
