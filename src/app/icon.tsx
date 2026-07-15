import { ImageResponse } from "next/og";

// Browser-tab favicon. Same mark as apple-icon, sized for a tab.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        SR
      </div>
    ),
    size,
  );
}
