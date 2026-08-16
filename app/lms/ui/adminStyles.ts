export const ui = {
  page: { padding: "28px 24px", maxWidth: 1180, margin: "0 auto" } as const,

  card: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 18,
  } as const,

  tableWrap: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    overflow: "hidden",
  } as const,

  table: { width: "100%", borderCollapse: "collapse" } as const,

  th: {
    textAlign: "left",
    fontSize: 12,
    letterSpacing: 0.2,
    opacity: 0.8,
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
  } as const,

  td: { padding: "12px 14px", verticalAlign: "top" } as const,

  btn: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
    color: "inherit",
  } as const,

  btnPrimary: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.12)",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
    color: "inherit",
  } as const,

  pill: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.03)",
    opacity: 0.85,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    whiteSpace: "nowrap",
  } as const,
};
