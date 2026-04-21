import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Compression Analyzer: stop guessing compression settings";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: 72,
          background: "linear-gradient(145deg, #0a0a0b 0%, #111113 45%, #0a0a0b 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 40px rgba(59, 130, 246, 0.35)",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <span style={{ fontSize: 28, fontWeight: 600, color: "#fafafa" }}>
            Compression Analyzer
          </span>
        </div>
        <div
          style={{
            fontSize: 58,
            fontWeight: 700,
            color: "#fafafa",
            lineHeight: 1.08,
            letterSpacing: -0.03,
            maxWidth: 900,
          }}
        >
          Stop guessing your compression settings
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 26,
            color: "#a1a1aa",
            maxWidth: 820,
            lineHeight: 1.45,
          }}
        >
          Upload your audio and get ratio, attack, release, and threshold tuned to
          your sound.
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 18,
            color: "#60a5fa",
            fontWeight: 600,
          }}
        >
          Upload · analyze · dial in faster
        </div>
      </div>
    ),
    { ...size },
  );
}
