import { ImageResponse } from "next/og";

// Generated rather than committed as a binary: iOS needs a real PNG for the
// home-screen icon (it ignores SVG), and 180x180 is the iPad/iPhone touch-icon size.
// iOS also does not apply the manifest's background, so the tile is painted here.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#6e2e26",
          color: "#f6edde",
          fontSize: 84,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        SR
      </div>
    ),
    size,
  );
}
