'use client';

import { useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AudioInputProps {
	/** Called with the transcribed text once recording is processed. */
	onTranscript: (text: string) => void;
	disabled?: boolean;
	className?: string;
	/** Optional label for screen readers; defaults describe the record action. */
	'aria-label'?: string;
}

type Phase = 'idle' | 'recording' | 'transcribing';

/**
 * A single mic button that records a short voice note, sends it to /api/transcribe,
 * and hands the resulting text back via onTranscript. Drop it next to any text input.
 */
export function AudioInput({ onTranscript, disabled, className, ...rest }: AudioInputProps) {
	const [phase, setPhase] = useState<Phase>('idle');
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);

	const stopStream = () => {
		streamRef.current?.getTracks().forEach(track => track.stop());
		streamRef.current = null;
	};

	const transcribe = async (blob: Blob) => {
		setPhase('transcribing');
		try {
			const form = new FormData();
			form.append('audio', blob, 'recording.webm');
			const res = await fetch('/api/transcribe', { method: 'POST', body: form });
			const data = await res.json();
			if (!res.ok) {
				toast.error(data.error || 'Could not transcribe audio.');
				return;
			}
			const text = (data.text || '').trim();
			if (!text) {
				toast.error('No speech detected. Try again.');
				return;
			}
			onTranscript(text);
		} catch {
			toast.error('Could not transcribe audio. Please try again.');
		} finally {
			setPhase('idle');
		}
	};

	const startRecording = async () => {
		if (
			typeof navigator === 'undefined' ||
			!navigator.mediaDevices?.getUserMedia ||
			typeof MediaRecorder === 'undefined'
		) {
			toast.error('Voice input is not supported on this device.');
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			chunksRef.current = [];
			const recorder = new MediaRecorder(stream);
			mediaRecorderRef.current = recorder;
			recorder.ondataavailable = e => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};
			recorder.onstop = () => {
				stopStream();
				const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
				if (blob.size > 0) void transcribe(blob);
				else setPhase('idle');
			};
			recorder.start();
			setPhase('recording');
		} catch {
			stopStream();
			toast.error('Microphone access was denied.');
			setPhase('idle');
		}
	};

	const stopRecording = () => {
		if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
	};

	const handleClick = () => {
		if (phase === 'idle') void startRecording();
		else if (phase === 'recording') stopRecording();
	};

	return (
		<Button
			type="button"
			variant={phase === 'recording' ? 'destructive' : 'outline'}
			size="icon"
			disabled={disabled || phase === 'transcribing'}
			onClick={handleClick}
			className={cn('shrink-0', className)}
			aria-label={
				rest['aria-label'] ||
				(phase === 'recording'
					? 'Stop recording'
					: phase === 'transcribing'
						? 'Transcribing'
						: 'Record voice input')
			}
		>
			{phase === 'transcribing' ? (
				<Loader2 className="h-4 w-4 animate-spin" />
			) : phase === 'recording' ? (
				<Square className="h-4 w-4" />
			) : (
				<Mic className="h-4 w-4" />
			)}
		</Button>
	);
}
