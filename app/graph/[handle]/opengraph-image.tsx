import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Instagram network graph";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const clean = decodeURIComponent(handle).replace(/^@/, "");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "radial-gradient(circle at 30% 20%, #2a1240 0%, #07060d 55%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 30,
            color: "rgba(255,255,255,0.55)",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: "#cd486b",
            }}
          />
          Netgraph · Instagram network
        </div>

        <div style={{ display: "flex", fontSize: 84, fontWeight: 800 }}>
          @{clean}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 46,
            marginTop: 12,
            background:
              "linear-gradient(90deg,#fccc63,#fbad50,#cd486b,#8a3ab9,#4c68d7)",
            backgroundClip: "text",
            color: "transparent",
            fontWeight: 700,
          }}
        >
          See this network, visualized.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 28,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          Drop in any handle → watch the graph render in real time.
        </div>
      </div>
    ),
    { ...size },
  );
}
