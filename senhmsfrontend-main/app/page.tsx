"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, getSession, isTabAuthenticated } from "./_lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checking,     setChecking]     = useState(true);
  // If a valid session already exists, skip the login page
  useEffect(() => {
    if (getSession() && isTabAuthenticated()) {
      router.replace("/dashboard");
    } else {
      setChecking(false);
      // Prevent back button returning to dashboard after logout:
      // Replace the current history entry so back goes out of the app, not back in.
      window.history.replaceState(null, "", "/");
    }
  }, [router]);

  if (checking) {
    // Show a minimal loading state rather than blank white while redirecting
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 text-sky-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Cookies are set by the API route — navigate to dashboard
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 overflow-hidden">

        {/* Text content — left half of panel */}
        <div className="flex flex-col justify-between p-12 w-1/2 flex-shrink-0">
          {/* Top */}
          <div>
            {/* Logo + name */}
            <div className="flex items-center gap-3 mb-16">
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white shadow-lg flex-shrink-0">
                <Image
                  src="/hos-logo.jpg"
                  alt="Sen Hospital Logo"
                  width={48}
                  height={48}
                  className="object-contain w-full h-full"
                />
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-tight">Sen Hospital</p>
                <p className="text-slate-300 text-xs">Hospital Management System</p>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Manage your hospital<br />
              <span className="text-sky-400">smarter, faster.</span>
            </h1>
            <p className="text-slate-300 text-base leading-relaxed">
              A complete hospital information system — from patient registration to discharge,
              billing, and insurance — all in one place.
            </p>
          </div>

          {/* Feature pills — bottom */}
          <div>
            <div className="grid grid-cols-1 gap-2">
              {[
                { icon: "👥", label: "Patient Management"  },
                { icon: "🏥", label: "Ward & Bed Tracking"  },
                { icon: "🔬", label: "Lab & Investigations" },
                { icon: "💳", label: "Billing & Insurance"  },
                { icon: "📅", label: "Appointments"         },
                { icon: "📊", label: "Reports & Analytics"  },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
                  <span className="text-base">{f.icon}</span>
                  <span className="text-slate-200 text-xs font-medium">{f.label}</span>
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-xs mt-4">© 2026 Sen Hospital. All rights reserved.</p>
          </div>
        </div>

        {/* Hospital image — right half of panel */}
        <div className="relative flex-1">
          <Image
            src="/hospital-image.png"
            alt="Sen Hospital building"
            fill
            sizes="25vw"
            className="object-cover object-center"
            priority
          />
          {/* Subtle left-edge fade to blend with text panel */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/60 via-transparent to-transparent" />
        </div>

      </div>

      {/* ── Right panel — Login form ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:px-16">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-white border border-slate-200 flex-shrink-0">
            <Image
              src="/hos-logo.jpg"
              alt="Sen Hospital Logo"
              width={36}
              height={36}
              className="object-contain w-full h-full"
            />
          </div>
          <span className="text-slate-900 font-bold text-lg">Sen Hospital</span>
        </div>

        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@senhospital.com"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm
                  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                  transition-shadow"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm
                    placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                    transition-shadow pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-semibold
                py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
