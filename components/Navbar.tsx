"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function getInitialUser() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      }
    }
    getInitialUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(uid: string) {
    try {
      const { data } = await supabase
        .from("creator_profiles")
        .select("name")
        .eq("user_id", uid)
        .single();
      if (data) setProfile(data);
    } catch (err) {
      console.error("Failed to load navbar profile:", err);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/profile");
  };

  return (
    <nav className="glass sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[--mc-border]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6C5CE7] to-[#00D2D3] flex items-center justify-center text-white font-bold text-sm group-hover:scale-110 transition-transform">
            M
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-[#6C5CE7] to-[#00D2D3] bg-clip-text text-transparent">
            MoneyCaption
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/calculate"
            className="text-sm font-medium text-[--mc-text-secondary] hover:text-[--mc-primary] transition-colors"
          >
            Calculator
          </Link>
          {user ? (
            <div className="flex items-center gap-4">
              <Link
                href="/profile"
                className="text-sm font-medium text-[--mc-text-secondary] hover:text-[--mc-primary] transition-colors"
              >
                Dashboard {profile?.name ? `(${profile.name})` : ""}
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-[--mc-text-secondary] hover:text-[--mc-error] transition-colors cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link
                href="/profile"
                className="text-sm font-medium text-[--mc-text-secondary] hover:text-[--mc-primary] transition-colors"
              >
                Login
              </Link>
              <Link
                href="/profile?view=signup"
                className="mc-btn mc-btn-primary mc-btn-sm"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex md:hidden items-center justify-center w-9 h-9 rounded-lg border border-[--mc-border] text-[--mc-text-primary] hover:bg-[--mc-bg-elevated] transition-colors focus:outline-none cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {isOpen ? (
            <span className="text-lg font-bold">✕</span>
          ) : (
            <span className="text-lg">☰</span>
          )}
        </button>
      </div>

      {/* Mobile Menu Dropdown Overlay */}
      {isOpen && (
        <div className="md:hidden border-t border-[--mc-border] bg-white py-4 px-6 space-y-4">
          <div className="flex flex-col gap-4">
            <Link
              href="/calculate"
              onClick={() => setIsOpen(false)}
              className="text-sm font-medium text-[--mc-text-secondary] hover:text-[--mc-primary] py-2 border-b border-[--mc-border]/50 transition-colors"
            >
              Calculator
            </Link>
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setIsOpen(false)}
                  className="text-sm font-medium text-[--mc-text-secondary] hover:text-[--mc-primary] py-2 border-b border-[--mc-border]/50 transition-colors"
                >
                  Dashboard {profile?.name ? `(${profile.name})` : ""}
                </Link>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleLogout();
                  }}
                  className="text-sm font-medium text-left text-[--mc-text-secondary] hover:text-[--mc-error] py-2 transition-colors cursor-pointer"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/profile"
                  onClick={() => setIsOpen(false)}
                  className="text-sm font-medium text-[--mc-text-secondary] hover:text-[--mc-primary] py-2 border-b border-[--mc-border]/50 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/profile?view=signup"
                  onClick={() => setIsOpen(false)}
                  className="mc-btn mc-btn-primary mc-btn-sm w-full text-center py-2"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
