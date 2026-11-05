"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100vh", gap: "16px",
          fontFamily: "system-ui, sans-serif", background: "#f8fafc", padding: "24px",
        }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1e293b" }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: "14px", color: "#64748b", textAlign: "center", maxWidth: "400px" }}>
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "8px 20px", background: "#0ea5e9", color: "#fff",
              border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px",
            }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
