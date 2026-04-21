"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";

const ACCEPTED_TYPES = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/flac", "audio/ogg", "audio/x-wav", "audio/x-flac"];
const ACCEPTED_EXTENSIONS = [".wav", ".mp3", ".flac", ".ogg"];
const MAX_FILE_SIZE_MB = 20;

type AudioUploaderProps = {
  onFileSelected: (file: File) => void;
};

export default function AudioUploader({ onFileSelected }: AudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // HTML drag events fire for every child element the cursor crosses —
  // moving over the icon fires `dragleave` on the parent, which would
  // clear `isDragging` even though the drag is still in flight. Tracking
  // the enter/leave count in a ref lets us clear the state only when
  // every entered element has also been left.
  const dragDepthRef = useRef(0);

  const validateFile = (file: File): string | null => {
    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > MAX_FILE_SIZE_MB) {
      return `File is ${sizeMB.toFixed(1)} MB. Max size is ${MAX_FILE_SIZE_MB} MB.`;
    }

    const hasValidType =
      ACCEPTED_TYPES.includes(file.type) ||
      ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidType) {
      return "Unsupported format. Use WAV, MP3, FLAC, or OGG.";
    }

    return null;
  };

  const handleFile = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onFileSelected(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    if (dragDepthRef.current === 1) setIsDragging(true);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    // MUST preventDefault for `drop` to fire at all — without this, the
    // browser falls back to its default behaviour of opening the file.
    e.preventDefault();
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    if (files.length > 1) {
      setError(
        `Drop one file at a time. You added ${files.length} files. Pick the single audio file you want to analyse.`,
      );
      return;
    }
    handleFile(files[0]);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div>
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-brand-500 bg-brand-500/5"
            : "border-surface-500 hover:border-brand-500/50"
        }`}
      >
        <div className="w-14 h-14 bg-surface-700 rounded-xl mx-auto mb-4 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <p className="text-gray-300 font-medium mb-1.5">
          {isDragging ? "Drop to upload" : "Click or drag audio here"}
        </p>
        <p className="text-gray-600 text-sm">
          WAV, MP3, FLAC, OGG · Max {MAX_FILE_SIZE_MB}MB
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
