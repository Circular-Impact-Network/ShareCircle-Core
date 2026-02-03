import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MessageComposer } from '@/components/chat/MessageComposer';

describe('MessageComposer', () => {
	it('sends message on Enter', async () => {
		const user = userEvent.setup();
		const onSend = vi.fn();
		const onChange = vi.fn();

		render(<MessageComposer value="Hello" onChange={onChange} onSend={onSend} />);

		await user.type(screen.getByPlaceholderText('Type a message...'), '{enter}');
		expect(onSend).toHaveBeenCalledTimes(1);
	});

	it('calls onTyping when typing', async () => {
		const user = userEvent.setup();
		const onSend = vi.fn();
		const onChange = vi.fn();
		const onTyping = vi.fn();

		render(<MessageComposer value="" onChange={onChange} onSend={onSend} onTyping={onTyping} />);

		await user.type(screen.getByPlaceholderText('Type a message...'), 'Hi');
		expect(onTyping).toHaveBeenCalled();
	});
});
