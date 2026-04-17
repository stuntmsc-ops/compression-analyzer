"use client";

import { useState, useEffect } from "react";
import Button from "./Button";
import AudioUploader from "./AudioUploader";
import AudioPlayer from "./AudioPlayer";
import { decodeAudioFile } from "@/lib/audioContext";

export default function Hero() {
  const [file, setFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [decodingError, setDecodingError] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  useEffect(() => {
    if (!file) {
      setAudioBuffer(null);
      setDecodingError(null);
      return;
    }

    let cancelled = false;
    setIsDecoding(true);
    setDecodingError(null);

    decodeAudioFile(file)
      .then((buffer) => {
        if (!cancelled) setAudioBuffer(buffer);
      })
      .catch((err) => {
        if (!cancelled) {
          setDecodingError(err instanceof Error ? err.message : "Decoding failed");
          setAudioBuffer(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsDecoding(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleRemove = () => {
    setFile(null);
    setAudioBuffer(null);
    setDecodingError(null);
  };

  const scrollToUpload = () => {
    document.getElementById("upload-zone")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 mb-6 sm:mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400"></span>
          </span>
          <span className="text-brand-400 text-xs sm:text-sm font-medium">
            Audio-Powered Compression Settings
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-5 sm:mb-6 leading-[1.1] tracking-tight">
          Stop Guessing Your
          <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
            {" "}Compression Settings
          </span>
        </h1>

        <p className="text-gray-400 text-base sm:text-lg mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
          Upload your audio and get personalized compression settings based on
          the actual dynamics of your sound — not generic numbers from a chart.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <Button size="lg" onClick={scrollToUpload}>
            Analyze Your Audio
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </Button>
          <p className="text-gray-600 text-xs sm:text-sm">
            No signup to try · Free for vocals
          </p>
        </div>

        {/* Upload zone */}
        <div
          id="upload-zone"
          className="bg-surface-800 border border-surface-700 rounded-2xl p-4 sm:p-6 max-w-2xl mx-auto shadow-2xl text-left"
        >
          {!file ? (
            <AudioUploader onFileSelected={setFile} />
          ) : (
            <div className="space-y-4">
              {isDecoding && (
                <div className="flex items-center gap-3 text-gray-400 text-sm px-1">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <span>Decoding audio…</span>
                </div>
              )}

              {decodingError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {decodingError}
                </div>
              )}

              {audioBuffer && (
                <AudioPlayer audioBuffer={audioBuffer} fileName={file.name} />
              )}

              <div className="flex items-center justify-between px-1">
                <p className="text-gray-500 text-xs">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · {file.type || "audio"}
                </p>
                <Button variant="ghost" size="sm" onClick={handleRemove}>
                  Remove
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
