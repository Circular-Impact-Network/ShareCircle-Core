/**
 * Unit tests for useTypingIndicator hook
 * Tests: typing indicator functionality, broadcast handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTypingIndicator } from '@/hooks/usePresence';
import type { ChatUser } from '@/components/chat/types';

// Mock Supabase client
const mockChannel = vi.fn();
const mockSend = vi.fn();
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
const mockOn = vi.fn();

let broadcastHandlers: Record<string, (payload: { payload: unknown }) => void> = {};

vi.mock('@/lib/supabaseClient', () => ({
	createBrowserSupabaseClient: () => ({
		channel: (name: string) => {
			mockChannel(name);
			return {
				on: (_type: string, { event }: { event: string }, handler: (payload: { payload: unknown }) => void) => {
					mockOn(event);
					broadcastHandlers[event] = handler;
					return {
						subscribe: mockSubscribe,
						on: mockOn,
					};
				},
				send: mockSend,
				subscribe: mockSubscribe,
				unsubscribe: mockUnsubscribe,
			};
		},
	}),
}));

describe('useTypingIndicator Hook', () => {
	const currentUser: ChatUser = {
		id: 'user-1',
		name: 'Current User',
		avatar: null,
	};

	const otherUser: ChatUser = {
		id: 'user-2',
		name: 'Other User',
		avatar: null,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		broadcastHandlers = {};
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns empty typingUserIds initially', () => {
		const { result } = renderHook(() => useTypingIndicator('conversation-1', currentUser));

		expect(result.current.typingUserIds).toEqual([]);
	});

	it('returns sendTyping function', () => {
		const { result } = renderHook(() => useTypingIndicator('conversation-1', currentUser));

		expect(typeof result.current.sendTyping).toBe('function');
	});

	it('does not subscribe when conversationId is null', () => {
		renderHook(() => useTypingIndicator(null, currentUser));

		expect(mockChannel).not.toHaveBeenCalled();
	});

	it('does not subscribe when currentUser is null', () => {
		renderHook(() => useTypingIndicator('conversation-1', null));

		expect(mockChannel).not.toHaveBeenCalled();
	});

	it('subscribes to typing channel with correct name', () => {
		renderHook(() => useTypingIndicator('conversation-1', currentUser));

		expect(mockChannel).toHaveBeenCalledWith('typing:conversation-1');
	});

	it('subscribes to typing events', () => {
		renderHook(() => useTypingIndicator('conversation-1', currentUser));

		expect(mockOn).toHaveBeenCalledWith('typing');
	});

	it('unsubscribes on unmount', () => {
		const { unmount } = renderHook(() => useTypingIndicator('conversation-1', currentUser));

		unmount();

		expect(mockUnsubscribe).toHaveBeenCalled();
	});

	it('adds user to typingUserIds when typing broadcast received', async () => {
		const { result } = renderHook(() => useTypingIndicator('conversation-1', currentUser));

		// Simulate receiving typing broadcast from other user
		act(() => {
			if (broadcastHandlers.typing) {
				broadcastHandlers.typing({ payload: { userId: otherUser.id } });
			}
		});

		expect(result.current.typingUserIds).toContain(otherUser.id);
	});

	it('ignores typing broadcast from current user', async () => {
		const { result } = renderHook(() => useTypingIndicator('conversation-1', currentUser));

		// Simulate receiving typing broadcast from current user (should be ignored)
		act(() => {
			if (broadcastHandlers.typing) {
				broadcastHandlers.typing({ payload: { userId: currentUser.id } });
			}
		});

		expect(result.current.typingUserIds).not.toContain(currentUser.id);
	});

	it('removes user from typingUserIds after timeout', async () => {
		const { result } = renderHook(() => useTypingIndicator('conversation-1', currentUser));

		// Simulate receiving typing broadcast
		act(() => {
			if (broadcastHandlers.typing) {
				broadcastHandlers.typing({ payload: { userId: otherUser.id } });
			}
		});

		expect(result.current.typingUserIds).toContain(otherUser.id);

		// Fast-forward past the timeout (2.5 seconds)
		act(() => {
			vi.advanceTimersByTime(2500);
		});

		expect(result.current.typingUserIds).not.toContain(otherUser.id);
	});

	it('resets timeout when same user sends another typing event', async () => {
		const { result } = renderHook(() => useTypingIndicator('conversation-1', currentUser));

		// First typing event
		act(() => {
			if (broadcastHandlers.typing) {
				broadcastHandlers.typing({ payload: { userId: otherUser.id } });
			}
		});

		// Wait 2 seconds (less than timeout)
		act(() => {
			vi.advanceTimersByTime(2000);
		});

		// User should still be typing
		expect(result.current.typingUserIds).toContain(otherUser.id);

		// Second typing event - resets timeout
		act(() => {
			if (broadcastHandlers.typing) {
				broadcastHandlers.typing({ payload: { userId: otherUser.id } });
			}
		});

		// Wait another 2 seconds (4 seconds total, but timeout was reset)
		act(() => {
			vi.advanceTimersByTime(2000);
		});

		// User should still be typing because timeout was reset
		expect(result.current.typingUserIds).toContain(otherUser.id);

		// Wait for full timeout from reset
		act(() => {
			vi.advanceTimersByTime(600);
		});

		// Now user should be removed
		expect(result.current.typingUserIds).not.toContain(otherUser.id);
	});

	it('handles multiple users typing', async () => {
		const { result } = renderHook(() => useTypingIndicator('conversation-1', currentUser));

		// Multiple users start typing
		act(() => {
			if (broadcastHandlers.typing) {
				broadcastHandlers.typing({ payload: { userId: 'user-2' } });
				broadcastHandlers.typing({ payload: { userId: 'user-3' } });
				broadcastHandlers.typing({ payload: { userId: 'user-4' } });
			}
		});

		expect(result.current.typingUserIds).toHaveLength(3);
		expect(result.current.typingUserIds).toContain('user-2');
		expect(result.current.typingUserIds).toContain('user-3');
		expect(result.current.typingUserIds).toContain('user-4');
	});

	it('does not duplicate user in typingUserIds', async () => {
		const { result } = renderHook(() => useTypingIndicator('conversation-1', currentUser));

		// Same user types multiple times
		act(() => {
			if (broadcastHandlers.typing) {
				broadcastHandlers.typing({ payload: { userId: otherUser.id } });
				broadcastHandlers.typing({ payload: { userId: otherUser.id } });
				broadcastHandlers.typing({ payload: { userId: otherUser.id } });
			}
		});

		expect(result.current.typingUserIds).toHaveLength(1);
		expect(result.current.typingUserIds).toEqual([otherUser.id]);
	});

	it('sendTyping broadcasts typing event', async () => {
		const { result } = renderHook(() => useTypingIndicator('conversation-1', currentUser));

		act(() => {
			result.current.sendTyping();
		});

		expect(mockSend).toHaveBeenCalledWith({
			type: 'broadcast',
			event: 'typing',
			payload: { userId: currentUser.id },
		});
	});

	it('sendTyping does nothing when currentUser is null', () => {
		const { result } = renderHook(() => useTypingIndicator('conversation-1', null));

		act(() => {
			result.current.sendTyping();
		});

		expect(mockSend).not.toHaveBeenCalled();
	});

	it('clears all timeouts on unmount', async () => {
		const { result, unmount } = renderHook(() => useTypingIndicator('conversation-1', currentUser));

		// Add some typing users
		act(() => {
			if (broadcastHandlers.typing) {
				broadcastHandlers.typing({ payload: { userId: 'user-2' } });
				broadcastHandlers.typing({ payload: { userId: 'user-3' } });
			}
		});

		expect(result.current.typingUserIds).toHaveLength(2);

		// Unmount should clear timeouts
		unmount();

		// No errors should occur when timers fire after unmount
		act(() => {
			vi.advanceTimersByTime(3000);
		});
	});

	it('handles missing userId in payload gracefully', async () => {
		const { result } = renderHook(() => useTypingIndicator('conversation-1', currentUser));

		// Simulate malformed payload
		act(() => {
			if (broadcastHandlers.typing) {
				broadcastHandlers.typing({ payload: {} });
				broadcastHandlers.typing({ payload: { userId: undefined } });
			}
		});

		expect(result.current.typingUserIds).toEqual([]);
	});

	it('resubscribes when conversationId changes', () => {
		const { rerender } = renderHook(
			({ conversationId }) => useTypingIndicator(conversationId, currentUser),
			{ initialProps: { conversationId: 'conversation-1' } }
		);

		expect(mockChannel).toHaveBeenCalledWith('typing:conversation-1');

		mockChannel.mockClear();
		mockUnsubscribe.mockClear();

		rerender({ conversationId: 'conversation-2' });

		expect(mockUnsubscribe).toHaveBeenCalled();
		expect(mockChannel).toHaveBeenCalledWith('typing:conversation-2');
	});
});
