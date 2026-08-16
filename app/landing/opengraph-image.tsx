import { ImageResponse } from "next/og";

export const alt = "Перезагрузка — Подготовка к ОГЭ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
          background: "#17122a",
          backgroundImage:
            "radial-gradient(circle at 15% 15%, rgba(147,51,234,0.35), transparent 45%), radial-gradient(circle at 85% 85%, rgba(245,158,11,0.25), transparent 45%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#a855f7",
            }}
          />
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#c4b5fd",
            }}
          >
            Перезагрузка
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.15,
            color: "#f8fafc",
            maxWidth: 980,
          }}
        >
          <span>Подготовим к ОГЭ так,</span>
          <span>
            что ребёнок{" "}
            <span style={{ color: "#c4b5fd" }}>сядет заниматься сам</span>
          </span>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 30,
            color: "#cbd5e1",
          }}
        >
          Живой учитель + ИИ-репетитор 24/7
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 48,
            padding: "14px 32px",
            borderRadius: 16,
            background: "linear-gradient(to right, #fbbf24, #f59e0b)",
            color: "#0f172a",
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          Бесплатная диагностика
        </div>
      </div>
    ),
    { ...size },
  );
}
