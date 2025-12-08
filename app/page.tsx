'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
	const router = useRouter();

	useEffect(() => {
		const isAuthenticated = localStorage.getItem('sharecircle_auth') === 'true';

		if (isAuthenticated) {
			router.push('/dashboard');
		} else {
			router.push('/landing');
		}
	}, [router]);

	return null;
}
