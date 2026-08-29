import { ImageResponse } from "next/og";

/** App icon rendered at runtime — a green rounded square with a white check.
 *  No font data needed since it's pure SVG shapes. */
export function renderIcon(size: number, opts?: { maskable?: boolean }) {
  const maskable = opts?.maskable ?? false;
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const glyph = Math.round(size * (maskable ? 0.5 : 0.62));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#2E6B4F",
          borderRadius: radius,
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FDFCFA"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=86400" },
    }
  );
}
