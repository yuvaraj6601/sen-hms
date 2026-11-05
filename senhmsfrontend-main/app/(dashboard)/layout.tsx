"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSession, logout, isTabAuthenticated, clearTabAuth, type Session } from "../_lib/auth";
import Sidebar from "../_components/Sidebar";
import Header from "../_components/Header";
import { useIdleTimeout } from "../_hooks/useIdleTimeout";

// Idle timeout: 15 minutes of inactivity triggers the lock overlay
const IDLE_TIMEOUT_MS  = 15 * 60 * 1000;
// Warning shown 2 minutes before forced logout
const IDLE_WARN_MS     = 13 * 60 * 1000;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const [session,     setSession]     = useState<Session | null>(null);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [mounted,     setMounted]     = useState(false);
  // idle overlay states: "none" | "warning" | "locked"
  const [idleState,   setIdleState]   = useState<"none" | "warning" | "locked">("none");
  const [countdown,   setCountdown]   = useState(120); // seconds left shown in warning

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = getSession();

    // Check both cookie AND per-tab sessionStorage marker.
    // A copied URL in a new tab has the cookie but not the tab marker → login.
    if (!s || !isTabAuthenticated()) {
      clearTabAuth();
      router.replace("/");
      return;
    }
    setSession(s);
    setMounted(true);

    // Prevent back-button returning to this page after logout:
    // Push a history entry so back goes to the dashboard, not outside the app.
    window.history.pushState(null, "", window.location.href);
    const handlePop = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [router]);

  // Safety net: if still not mounted after 3s, redirect to login
  useEffect(() => {
    const t = setTimeout(() => {
      if (!mounted) router.replace("/");
    }, 3000);
    return () => clearTimeout(t);
  }, [mounted, router]);

  // ── Idle timeout ──────────────────────────────────────────────────────────
  const handleIdle = useCallback(() => {
    setIdleState("locked");
  }, []);

  const handleIdleWarning = useCallback(() => {
    setIdleState("warning");
    setCountdown(120);
  }, []);

  // Warning fires 2 min before full idle
  useIdleTimeout(handleIdleWarning, IDLE_WARN_MS);
  // Full idle lock fires at 15 min
  useIdleTimeout(handleIdle, IDLE_TIMEOUT_MS);

  // Countdown ticker when warning is shown
  useEffect(() => {
    if (idleState !== "warning") return;
    if (countdown <= 0) { setIdleState("locked"); return; }
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [idleState, countdown]);

  // ── Logout helpers ────────────────────────────────────────────────────────
  async function handleLogout() {
    await logout();
    // Replace so back button doesn't return to dashboard
    router.replace("/");
  }

  async function handleIdleLogout() {
    await logout();
    router.replace("/");
  }

  function handleStayLoggedIn() {
    // Reset idle state — the useIdleTimeout hook will auto-reset on next activity
    setIdleState("none");
  }

  // ── Skeleton while checking auth ─────────────────────────────────────────
  if (!mounted || !session) {
    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <div className="fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-40" />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden ml-64">
          <div className="h-16 bg-white border-b border-slate-200 flex-shrink-0" />
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto space-y-4 animate-pulse">
              <div className="h-8 bg-slate-200 rounded w-1/4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-24">
                    <div className="h-3 bg-slate-200 rounded w-3/4 mb-3" />
                    <div className="h-6 bg-slate-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm h-48" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`flex h-screen bg-slate-50 overflow-hidden
        ${idleState !== "none" ? "pointer-events-none" : ""}`}>
        <Sidebar
          role={session.role}
          userName={session.name}
          userEmail={session.email}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header
            userName={session.name}
            role={session.role}
            onMenuClick={() => setMobileOpen(true)}
            onLogout={handleLogout}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* ── Idle Warning Overlay ─────────────────────────────────────────── */}
      {idleState === "warning" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backdropFilter: "blur(6px)", background: "rgba(15,23,42,0.55)" }}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Still there?</h3>
            <p className="text-sm text-slate-500 mb-2">
              You've been inactive. You'll be logged out in
            </p>
            <p className="text-4xl font-bold text-amber-500 mb-5 tabular-nums">
              {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
            </p>
            <div className="flex gap-3">
              <button onClick={handleIdleLogout}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600
                  hover:bg-slate-50 text-sm font-medium transition-colors pointer-events-auto">
                Sign out
              </button>
              <button onClick={handleStayLoggedIn}
                className="flex-1 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white
                  text-sm font-semibold transition-colors pointer-events-auto">
                Stay logged in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Idle Locked Overlay ──────────────────────────────────────────── */}
      {idleState === "locked" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backdropFilter: "blur(8px)", background: "rgba(15,23,42,0.70)" }}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Session expired</h3>
            <p className="text-sm text-slate-500 mb-6">
              You were logged out due to inactivity. Please sign in again to continue.
            </p>
            <button onClick={handleIdleLogout}
              className="w-full px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white
                text-sm font-semibold transition-colors pointer-events-auto">
              Sign in again
            </button>
          </div>
        </div>
      )}
    </>
  );
}
