"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";

const PLATFORMS = [
  { name: "Instagram", icon: "📸", color: "#E1306C" },
  { name: "YouTube", icon: "🎬", color: "#FF0000" },
  { name: "Facebook", icon: "📘", color: "#1877F2" },
];

const FEATURES = [
  {
    icon: "⚡",
    title: "60-Second Rate Card",
    description:
      "Enter your follower count, niche, and engagement — get a professional rate card instantly.",
  },
  {
    icon: "🎯",
    title: "Multi-Platform Pricing",
    description:
      "Get rates for Reels, Stories, YouTube integrations, Facebook posts, and more — all in one place.",
  },
  {
    icon: "📄",
    title: "Download PDF Rate Card",
    description:
      "Professional, branded rate card PDF you can share directly with brands and agencies.",
  },
  {
    icon: "✅",
    title: "Verified Credibility",
    description:
      "Upload engagement screenshots to earn a verification badge that builds brand trust.",
  },
];

const STEPS = [
  { step: "01", title: "Enter your details", desc: "Platform, followers, niche & city" },
  { step: "02", title: "Get your rates", desc: "Instant pricing across all deliverables" },
  { step: "03", title: "Download & share", desc: "Professional PDF rate card" },
];

export default function LandingPage() {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setMousePos({ x, y });
      document.documentElement.style.setProperty("--mouse-x", `${x}%`);
      document.documentElement.style.setProperty("--mouse-y", `${y}%`);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Ambient background glow */}
      <div
        className="fixed inset-0 pointer-events-none opacity-60 -z-10"
        style={{
          background: `radial-gradient(800px circle at ${mousePos.x}% ${mousePos.y}%, rgba(108, 92, 231, 0.06), transparent 50%)`,
        }}
      />

      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div
          className="absolute top-20 left-10 w-72 h-72 rounded-full opacity-10 animate-float"
          style={{ background: "radial-gradient(circle, #6C5CE7, transparent)" }}
        />
        <div
          className="absolute top-60 right-20 w-96 h-96 rounded-full opacity-8 animate-float"
          style={{
            background: "radial-gradient(circle, #00D2D3, transparent)",
            animationDelay: "1.5s",
          }}
        />
        <div
          className="absolute bottom-40 left-1/3 w-64 h-64 rounded-full opacity-6 animate-float"
          style={{
            background: "radial-gradient(circle, #A29BFE, transparent)",
            animationDelay: "3s",
          }}
        />
      </div>

      {/* ─── Navigation ─── */}
      <Navbar />

      {/* ─── Hero Section ─── */}
      <section className="relative pt-40 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Platform badges */}
          <div className="flex justify-center gap-3 mb-8 animate-fade-in opacity-0">
            {PLATFORMS.map((p) => (
              <span
                key={p.name}
                className="glass px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2"
              >
                <span>{p.icon}</span>
                <span style={{ color: p.color }}>{p.name}</span>
              </span>
            ))}
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 animate-fade-in-up opacity-0">
            Know your worth.
            <br />
            <span className="bg-gradient-to-r from-[#6C5CE7] via-[#A29BFE] to-[#00D2D3] bg-clip-text text-transparent animate-gradient">
              Get paid fairly.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[--mc-text-secondary] max-w-2xl mx-auto mb-10 animate-fade-in-up opacity-0 delay-200">
            Generate a brand-ready rate card in 60 seconds. Data-driven pricing
            for Instagram, YouTube & Facebook creators across India.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up opacity-0 delay-300">
            <Link
              href="/calculate"
              id="hero-cta"
              className="mc-btn mc-btn-primary mc-btn-lg animate-pulse-glow"
            >
              <span>Calculate My Rate</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/worth-calculator"
              className="mc-btn mc-btn-secondary mc-btn-lg bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20 flex items-center justify-center gap-2"
            >
              📊 Estimate Post Worth
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-12 flex justify-center items-center gap-6 text-sm text-[--mc-text-muted] animate-fade-in opacity-0 delay-500">
            <span className="flex items-center gap-1.5">
              <span className="text-[--mc-success]">●</span> Used by 2,000+ creators
            </span>
            <span className="hidden sm:inline text-[--mc-border]">|</span>
            <span className="flex items-center gap-1.5">
              <span className="text-[--mc-accent]">●</span> 3 platforms supported
            </span>
            <span className="hidden sm:inline text-[--mc-border]">|</span>
            <span className="flex items-center gap-1.5">
              <span className="text-[--mc-primary-light]">●</span> India-focused
            </span>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-24 px-6 relative">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="mc-badge mc-badge-blue mb-4 inline-block">How It Works</span>
            <h2 className="text-3xl md:text-4xl font-bold">
              Three steps. Sixty seconds.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div
                key={s.step}
                className="mc-card p-8 text-center group relative overflow-hidden"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[rgba(108,92,231,0.08)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="text-4xl font-extrabold bg-gradient-to-br from-[#6C5CE7] to-[#00D2D3] bg-clip-text text-transparent mb-4">
                    {s.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-[--mc-text-secondary]">{s.desc}</p>
                </div>
                {/* Connector line for desktop */}
                {i < 2 && (
                  <div className="hidden md:block absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-8 h-[2px] bg-[--mc-border]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-24 px-6 bg-[--mc-bg-secondary]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="mc-badge mc-badge-green mb-4 inline-block">Features</span>
            <h2 className="text-3xl md:text-4xl font-bold">
              Everything you need to quote confidently
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="mc-card p-8 group"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-[--mc-primary-light] transition-colors">
                  {f.title}
                </h3>
                <p className="text-sm text-[--mc-text-secondary] leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="py-24 px-6 relative">
        <div className="max-w-3xl mx-auto text-center">
          <div className="mc-card p-12 md:p-16 relative overflow-hidden">
            {/* Background gradient glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[rgba(108,92,231,0.12)] to-[rgba(0,210,211,0.06)]" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to know your worth?
              </h2>
              <p className="text-[--mc-text-secondary] mb-8 max-w-lg mx-auto">
                Join thousands of Indian creators who price their brand deals with
                confidence. No sign-up required.
              </p>
              <Link
                href="/calculate"
                id="cta-bottom"
                className="mc-btn mc-btn-primary mc-btn-lg"
              >
                Calculate My Rate — Free
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-12 px-6 border-t border-[--mc-border]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#6C5CE7] to-[#00D2D3] flex items-center justify-center text-white font-bold text-xs">
              M
            </div>
            <span className="text-sm font-semibold text-[--mc-text-secondary]">
              MoneyCaption
            </span>
          </div>
          <div className="flex gap-6 text-sm text-[--mc-text-muted]">
            {/* Reserved nav slots for Phase 2 SEO pages */}
            <span className="cursor-default hover:text-[--mc-text-secondary] transition-colors">
              Blog
            </span>
            <span className="cursor-default hover:text-[--mc-text-secondary] transition-colors">
              Resources
            </span>
            <span className="cursor-default hover:text-[--mc-text-secondary] transition-colors">
              Privacy
            </span>
          </div>
          <span className="text-xs text-[--mc-text-muted]">
            © {new Date().getFullYear()} MoneyCaption. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
