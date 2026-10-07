import { ImageResponse } from "next/og";

// Изображението, което се показва, когато някой сподели сайта (1200×630).
export const alt = "StructLab – инженерството, обяснено ясно";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#0A0F1C",
        color: "#EAF0F8",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 18,
            background: "#15213A",
            border: "2px solid #2B3B5E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="44" height="44" viewBox="0 0 36 36" fill="none">
            <path
              d="M6 7h24M6 29h24M18 7v22"
              stroke="#6EA8FF"
              strokeWidth="3.5"
            />
          </svg>
        </div>
        <div style={{ fontSize: 44, fontWeight: 700 }}>StructLab</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: -1,
          }}
        >
          Engineering, explained clearly.
        </div>
        <div style={{ fontSize: 32, color: "#B6C2D6", lineHeight: 1.4 }}>
          Strength of Materials · textbook in two modes · interactive labs
        </div>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {["Beams", "Sections", "Stress"].map((label) => (
          <div
            key={label}
            style={{
              display: "flex",
              padding: "12px 22px",
              borderRadius: 999,
              background: "#15213A",
              border: "2px solid #2B3B5E",
              fontSize: 26,
              color: "#9CC3FF",
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
