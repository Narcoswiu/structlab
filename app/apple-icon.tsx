import { ImageResponse } from "next/og";

// Икона за началния екран на iPhone/iPad (180×180), по логото.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#15213A",
      }}
    >
      <svg width="112" height="112" viewBox="0 0 36 36" fill="none">
        <path d="M6 7h24M6 29h24M18 7v22" stroke="#6EA8FF" strokeWidth="3.5" />
      </svg>
    </div>,
    size,
  );
}
