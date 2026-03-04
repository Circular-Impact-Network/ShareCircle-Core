import { ImageResponse } from 'next/og';

export const size = {
	width: 512,
	height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
	return new ImageResponse(
		(
			<div
				style={{
					display: 'flex',
					height: '100%',
					width: '100%',
					alignItems: 'center',
					justifyContent: 'center',
					background:
						'radial-gradient(circle at top, #38bdf8 0%, #2563eb 40%, #0f172a 100%)',
					color: 'white',
					fontSize: 188,
					fontWeight: 800,
					letterSpacing: '-0.08em',
				}}
			>
				<div
					style={{
						display: 'flex',
						height: 360,
						width: 360,
						alignItems: 'center',
						justifyContent: 'center',
						borderRadius: 112,
						border: '18px solid rgba(255,255,255,0.18)',
						background: 'rgba(15, 23, 42, 0.24)',
						boxShadow: '0 30px 70px rgba(15, 23, 42, 0.35)',
					}}
				>
					SC
				</div>
			</div>
		),
		size,
	);
}
