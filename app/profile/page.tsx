"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Untyped client to avoid generics mismatch with current supabase-js version
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CreatorProfile = Record<string, any>;

type AuthView = "phone" | "email" | "otp" | "profile";

export default function ProfilePage() {
  const [view, setView] = useState<AuthView>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Check if already logged in
  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        setView("profile");
        loadProfile(session.user.id);
      }
    }
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setView("profile");
        loadProfile(session.user.id);
      } else {
        setUserId(null);
        setProfile(null);
        setView("phone");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(uid: string) {
    try {
      const { data } = await supabase
        .from("creator_profiles")
        .select("*")
        .eq("user_id", uid)
        .single();
      if (data) setProfile(data as CreatorProfile);
    } catch {
      // No profile yet
    }
  }

  async function handlePhoneLogin() {
    setLoading(true);
    setError("");
    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
      const { error: authError } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });
      if (authError) throw authError;
      setView("otp");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send OTP";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin() {
    setLoading(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
      });
      if (authError) throw authError;
      setError("");
      alert("Check your email for a magic link!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send link";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setLoading(true);
    setError("");
    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
      const { error: authError } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: "sms",
      });
      if (authError) throw authError;
      // Auth state change listener will handle the rest
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid OTP";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setView("phone");
    setProfile(null);
    setUserId(null);
  }

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div
          className="absolute top-20 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #6C5CE7, transparent)" }}
        />
      </div>

      {/* Nav */}
      <nav className="glass sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#6C5CE7] to-[#00D2D3] flex items-center justify-center text-white font-bold text-xs group-hover:scale-110 transition-transform">
              M
            </div>
            <span className="text-base font-bold bg-gradient-to-r from-[#6C5CE7] to-[#00D2D3] bg-clip-text text-transparent">
              MoneyCaption
            </span>
          </a>
          {userId && (
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-[--mc-text-secondary] hover:text-[--mc-error] transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-6 py-16">
        {/* ── Login Views ── */}
        {view !== "profile" && (
          <div className="text-center mb-10 animate-fade-in opacity-0">
            <h1 className="text-3xl font-bold mb-2">
              {view === "otp" ? "Enter OTP" : "Login"}
            </h1>
            <p className="text-[--mc-text-secondary]">
              {view === "otp"
                ? `We sent a code to ${phone.startsWith("+") ? phone : `+91${phone}`}`
                : "Sign in to save and manage your rate cards"}
            </p>
          </div>
        )}

        {/* Phone Login */}
        {view === "phone" && (
          <div className="mc-card p-8 space-y-6 animate-fade-in opacity-0">
            <div>
              <label htmlFor="phone" className="mc-label">
                Phone Number
              </label>
              <div className="flex gap-2">
                <span className="mc-input w-16 text-center flex items-center justify-center text-sm text-[--mc-text-secondary]">
                  +91
                </span>
                <input
                  id="phone"
                  type="tel"
                  placeholder="98765 43210"
                  className="mc-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="mc-error-text">{error}</p>}

            <button
              onClick={handlePhoneLogin}
              disabled={loading || !phone}
              className="mc-btn mc-btn-primary w-full"
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>

            <div className="mc-divider" />

            <button
              onClick={() => setView("email")}
              className="mc-btn mc-btn-secondary w-full"
            >
              Use email instead
            </button>
          </div>
        )}

        {/* Email Login */}
        {view === "email" && (
          <div className="mc-card p-8 space-y-6 animate-fade-in opacity-0">
            <div>
              <label htmlFor="email" className="mc-label">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="mc-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && <p className="mc-error-text">{error}</p>}

            <button
              onClick={handleEmailLogin}
              disabled={loading || !email}
              className="mc-btn mc-btn-primary w-full"
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </button>

            <div className="mc-divider" />

            <button
              onClick={() => setView("phone")}
              className="mc-btn mc-btn-secondary w-full"
            >
              Use phone instead
            </button>
          </div>
        )}

        {/* OTP Verification */}
        {view === "otp" && (
          <div className="mc-card p-8 space-y-6 animate-fade-in opacity-0">
            <div>
              <label htmlFor="otp" className="mc-label">
                One-Time Password
              </label>
              <input
                id="otp"
                type="text"
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="mc-input text-center text-2xl tracking-[0.5em] font-mono"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            {error && <p className="mc-error-text">{error}</p>}

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
              className="mc-btn mc-btn-primary w-full"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

            <button
              onClick={() => {
                setView("phone");
                setOtp("");
                setError("");
              }}
              className="mc-btn mc-btn-secondary w-full"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Profile View ── */}
        {view === "profile" && (
          <div className="animate-fade-in opacity-0">
            <div className="text-center mb-10">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6C5CE7] to-[#00D2D3] flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                {profile?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <h1 className="text-2xl font-bold">
                {profile?.name || "Creator"}
              </h1>
              <p className="text-[--mc-text-secondary] text-sm mt-1">
                {profile?.niche || "No niche set"}
              </p>
            </div>

            {profile ? (
              <div className="space-y-6">
                {/* Profile details */}
                <div className="mc-card p-6 space-y-4">
                  <h2 className="font-semibold text-lg">Profile Details</h2>

                  <ProfileRow label="Phone" value={profile.phone || "—"} />
                  <ProfileRow label="Email" value={profile.email || "—"} />
                  <ProfileRow
                    label="City Tier"
                    value={
                      profile.city_tier?.replace("_", " ").toUpperCase() || "—"
                    }
                  />
                  <ProfileRow
                    label="Engagement Rate"
                    value={
                      profile.engagement_rate
                        ? `${profile.engagement_rate}%`
                        : "Pending review"
                    }
                  />
                  <ProfileRow
                    label="Verification"
                    value={
                      profile.verification_tier?.replace("_", " ") || "Self-reported"
                    }
                  />
                </div>

                {/* Platform stats */}
                <div className="mc-card p-6 space-y-4">
                  <h2 className="font-semibold text-lg">Platforms</h2>
                  {profile.followers_instagram && (
                    <ProfileRow
                      label="📸 Instagram"
                      value={`${profile.followers_instagram.toLocaleString("en-IN")} followers`}
                    />
                  )}
                  {profile.followers_youtube && (
                    <ProfileRow
                      label="🎬 YouTube"
                      value={`${profile.followers_youtube.toLocaleString("en-IN")} subscribers`}
                    />
                  )}
                  {profile.followers_facebook && (
                    <ProfileRow
                      label="📘 Facebook"
                      value={`${profile.followers_facebook.toLocaleString("en-IN")} followers`}
                    />
                  )}
                  {!profile.followers_instagram &&
                    !profile.followers_youtube &&
                    !profile.followers_facebook && (
                      <p className="text-sm text-[--mc-text-muted]">
                        No platforms added yet
                      </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <a
                    href="/calculate"
                    className="mc-btn mc-btn-primary w-full"
                  >
                    {profile ? "Update My Numbers" : "Calculate My Rate"}
                  </a>
                </div>
              </div>
            ) : (
              <div className="mc-card p-8 text-center">
                <p className="text-[--mc-text-secondary] mb-4">
                  No rate card generated yet.
                </p>
                <a href="/calculate" className="mc-btn mc-btn-primary">
                  Calculate My First Rate Card
                </a>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[--mc-border] last:border-0">
      <span className="text-sm text-[--mc-text-secondary]">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
