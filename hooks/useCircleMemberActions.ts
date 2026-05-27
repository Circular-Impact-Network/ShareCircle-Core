'use client';

import { useState } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useToast } from '@/hooks/useToast';
import {
	useUpdateMemberRoleMutation,
	useRemoveMemberMutation,
	useLeaveCircleMutation,
	type CircleMember,
} from '@/lib/redux/api/circlesApi';

export type MemberAction = 'promote' | 'demote' | 'remove' | 'leave';

// Encapsulates the member-management action handlers for circle-details page.
// Owns the selected-member / pending-action state so the page doesn't have to.
export function useCircleMemberActions({ circleId, router }: { circleId: string; router: AppRouterInstance }) {
	const { toast } = useToast();
	const [updateMemberRole] = useUpdateMemberRoleMutation();
	const [removeMember] = useRemoveMemberMutation();
	const [leaveCircle] = useLeaveCircleMutation();

	const [selectedMember, setSelectedMember] = useState<CircleMember | null>(null);
	const [memberAction, setMemberAction] = useState<MemberAction | null>(null);
	const [isProcessingMember, setIsProcessingMember] = useState(false);

	const reset = () => {
		setSelectedMember(null);
		setMemberAction(null);
	};

	const execute = async () => {
		if (!selectedMember || !memberAction) return;

		setIsProcessingMember(true);
		try {
			if (memberAction === 'promote' || memberAction === 'demote') {
				const newRole = memberAction === 'promote' ? 'ADMIN' : 'MEMBER';
				await updateMemberRole({ circleId, userId: selectedMember.userId, role: newRole }).unwrap();
				toast({
					title: 'Role updated',
					description: `${selectedMember.name || 'Member'} is now ${newRole === 'ADMIN' ? 'an admin' : 'a member'}.`,
				});
			} else if (memberAction === 'leave') {
				await leaveCircle(circleId).unwrap();
				toast({ title: 'Left circle', description: 'You have left this circle.' });
				router.push('/circles');
				return;
			} else if (memberAction === 'remove') {
				await removeMember({ circleId, userId: selectedMember.userId }).unwrap();
				toast({
					title: 'Member removed',
					description: `${selectedMember.name || 'Member'} has been removed from the circle.`,
				});
			}
		} catch (error) {
			toast({
				title: 'Error',
				description: (error as { data?: { error?: string } })?.data?.error || 'Failed to process action.',
				variant: 'destructive',
			});
		} finally {
			setIsProcessingMember(false);
			reset();
		}
	};

	return {
		selectedMember,
		memberAction,
		isProcessingMember,
		setSelectedMember,
		setMemberAction,
		reset,
		execute,
	};
}
