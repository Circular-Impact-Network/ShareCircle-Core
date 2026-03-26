import type React from 'react';

import Image from 'next/image';

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
						<Image
							src="/share-circle-logo.png"
							alt="ShareCircle"
							width={200}
							height={80}
							className="h-auto w-48 object-contain"
						/>
					</div>
					<h2 className="text-4xl font-display font-bold text-primary-foreground mb-4">{leftTitle}</h2>
					<p className="text-primary-foreground/80 text-lg">{leftDescription}</p>
				</div>
			</div>

			{/* Right side - Content */}
			<div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
				<div className="w-full max-w-md">
					<div className="lg:hidden flex justify-center mb-6">
						<Image
							src="/share-circle-logo.png"
							alt="ShareCircle"
							width={160}
							height={48}
							className="h-auto w-40 object-contain"
							priority
						/>
					</div>
					{rightHeader}
					{children}
				</div>
			</div>
		</div>
	);
}
