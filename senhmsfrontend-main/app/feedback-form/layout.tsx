// Public (no-auth) layout for the NABH patient feedback QR form.
// Mirrors the /opd passthrough layout — no sidebar, header, or auth guard.
export default function FeedbackPublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
