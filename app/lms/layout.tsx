import "./globals.css";

// Structural wrapper only. <html>/<body> live in the single root app/layout.tsx.
export default function LmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="lms-shell">{children}</div>;
}
