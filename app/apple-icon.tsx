import { ImageResponse } from 'next/og';

export const size = {
	width: 180,
	height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
	return new ImageResponse(
		(
			<div
				style={{
					display: 'flex',
					height: '100%',
					width: '100%',
					alignItems: 'center',
					justifyContent: 'center',
					background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 55%, #0f172a 100%)',
					borderRadius: 36,
					color: 'white',
					fontSize: 72,
					fontWeight: 800,
					letterSpacing: '-0.08em',
				}}
			>
				<div
					style={{
						display: 'flex',
						height: 126,
						width: 126,
						alignItems: 'center',
						justifyContent: 'center',
						borderRadius: 32,
						background: 'rgba(15, 23, 42, 0.18)',
						border: '8px solid rgba(255,255,255,0.2)',
					}}
				>
					SC
				</div>
			</div>
		),
		size,
	);
}
