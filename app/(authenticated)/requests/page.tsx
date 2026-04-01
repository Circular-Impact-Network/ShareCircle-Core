import { redirect } from 'next/navigation';

export default function RequestsRoute() {
	redirect('/notifications?tab=item-requests');
}
