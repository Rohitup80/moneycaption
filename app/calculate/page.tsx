import { Suspense } from "react";
import type { Metadata } from "next";
import CalculatorForm from "./CalculatorForm";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Calculate Your Rate",
  description:
    "Enter your platform details, niche, and follower count to get instant brand-deal pricing across Instagram, YouTube & Facebook.",
};

export default function CalculatePage() {
  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #6C5CE7, transparent)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #00D2D3, transparent)" }}
        />
      </div>

      {/* Nav */}
      <Navbar />

      {/* Main */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-10 animate-fade-in opacity-0">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Calculate Your{" "}
            <span className="bg-gradient-to-r from-[#6C5CE7] to-[#00D2D3] bg-clip-text text-transparent">
              Rate Card
            </span>
          </h1>
          <p className="text-[--mc-text-secondary]">
            Fill in your details below and get instant pricing for your brand deals.
          </p>
        </div>

        <Suspense fallback={
          <div className="flex justify-center items-center py-12">
            <svg className="animate-spin h-8 w-8 text-[--mc-primary]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        }>
          <CalculatorForm />
        </Suspense>
      </main>
    </div>
  );
}
