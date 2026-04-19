'use client';

import * as React from 'react';
import { useDropzone, type Accept } from 'react-dropzone';
import { cn } from '@/lib/utils';

interface DropzoneProps {
	accept?: Accept;
	maxFiles?: number;
	maxSize?: number;
	disabled?: boolean;
	title?: string;
	description?: string;
	helperText?: string;
	onDrop: (files: File[]) => void;
	className?: string;
	children?: React.ReactNode;
}

export function Dropzone({
	accept,
	maxFiles = 1,
	maxSize,
	disabled,
	title = 'Upload an image',
	description = 'Click or drag and drop',
	helperText,
	onDrop,
	className,
	children,
}: DropzoneProps) {
	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		accept,
		maxFiles,
		maxSize,
		disabled,
		onDrop: acceptedFiles => {
			if (acceptedFiles.length > 0) {
				onDrop(acceptedFiles);
			}
		},
	});

	return (
		<div
			{...getRootProps()}
			className={cn(
				'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
				disabled && 'cursor-not-allowed opacity-60',
				isDragActive
					? 'border-primary bg-primary/5'
					: 'border-border hover:bg-muted/50 hover:border-primary/50',
				className,
			)}
		>
			<input {...getInputProps()} />
			{children ? (
				children
			) : (
				<div className="flex flex-col items-center gap-2">
					<p className="font-medium text-foreground">{title}</p>
					<p className="text-sm text-muted-foreground">{description}</p>
					{helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
				</div>
			)}
		</div>
	);
}
