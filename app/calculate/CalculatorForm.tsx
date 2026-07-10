"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { cityOptions, cityTierMapping, nicheOptions } from "@/lib/rate-config";
import { createClient } from "@supabase/supabase-js";
import type { FetchResult } from "@/lib/social-fetch";
import { calculateRates } from "@/lib/rate-engine";

// Untyped client to avoid generics mismatch with current supabase-js version
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ──────────────────────────────────────────────
// Validation Schema
// ──────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\d{10}$/.test(val.replace(/\D/g, "")),
      "Phone number must be exactly 10 digits"
    ),
  city: z.string().min(1, "Please select your city"),
  platforms: z
    .array(z.enum(["instagram", "youtube", "facebook"]))
    .min(1, "Select at least one platform"),
  // Handle fields for auto-fetch
  handle_instagram: z.string().optional(),
  handle_youtube: z.string().optional(),
  handle_facebook: z.string().optional(),
  followers_instagram: z.number().optional(),
  followers_youtube: z.number().optional(),
  followers_facebook: z.number().optional(),
  niche: z.string().min(1, "Please select your niche"),
  engagement_rate: z.number().optional().nullable(),
  avgViewsInstagram: z.number().optional().nullable(),
  avgViewsYoutube: z.number().optional().nullable(),
  avgViewsFacebook: z.number().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

// Auto-fetch status per platform
interface FetchStatus {
  loading: boolean;
  fetched: boolean;
  error: string | null;
  verificationTier: string | null;
  dataSourceProvider: string | null;
}

const PLATFORM_OPTIONS = [
  {
    value: "instagram" as const,
    label: "Instagram",
    icon: "📸",
    color: "#E1306C",
    handlePlaceholder: "@username",
  },
  {
    value: "youtube" as const,
    label: "YouTube",
    icon: "🎬",
    color: "#FF0000",
    handlePlaceholder: "@channelname",
  },
  {
    value: "facebook" as const,
    label: "Facebook",
    icon: "📘",
    color: "#1877F2",
    handlePlaceholder: "pagename",
  },
];

const TOTAL_STEPS = 5;

export default function CalculatorForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [existingProfileId, setExistingProfileId] = useState<string | null>(null);
  const [fetchStatuses, setFetchStatuses] = useState<Record<string, FetchStatus>>({});
  // Track highest verification tier across all platforms
  const [autoVerificationTier, setAutoVerificationTier] = useState<string | null>(null);
  const [autoDataSource, setAutoDataSource] = useState<string | null>(null);
  const [profilePics, setProfilePics] = useState<Record<string, string | null>>({});
  const [followingCounts, setFollowingCounts] = useState<Record<string, number | null>>({});
  const [postsCounts, setPostsCounts] = useState<Record<string, number | null>>({});

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    trigger,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      city: "",
      platforms: [],
      handle_instagram: "",
      handle_youtube: "",
      handle_facebook: "",
      followers_instagram: undefined,
      followers_youtube: undefined,
      followers_facebook: undefined,
      niche: "",
      engagement_rate: null,
      avgViewsInstagram: null,
      avgViewsYoutube: null,
      avgViewsFacebook: null,
    },
  });

  const selectedPlatforms = watch("platforms") || [];

  // ── Auto-fetch handler (B2) ──
  const handleAutoFetch = useCallback(
    async (platform: "instagram" | "youtube" | "facebook", handle: string) => {
      const cleanHandle = handle.replace(/^@/, "").trim();
      if (!cleanHandle || cleanHandle.length < 2) return;

      // Mark as loading
      setFetchStatuses((prev) => ({
        ...prev,
        [platform]: { loading: true, fetched: false, error: null, verificationTier: null, dataSourceProvider: null },
      }));

      try {
        const response = await fetch("/api/fetch-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, handle: cleanHandle }),
        });

        const result: FetchResult = await response.json();

        if (result.success) {
          const d = result.data;
          // Auto-fill follower count
          const followerField = `followers_${platform}` as "followers_instagram" | "followers_youtube" | "followers_facebook";
          setValue(followerField, d.followers);

          // Auto-fill engagement if calculated
          if (d.engagementRate && d.engagementRate > 0) {
            // Only set if no engagement rate is already entered
            const currentER = watch("engagement_rate");
            if (!currentER) {
              setValue("engagement_rate", d.engagementRate);
            }
          }

          // Track verification tier
          setAutoVerificationTier(d.verificationTier);
          setAutoDataSource(d.dataSourceProvider);

          // Store profile pic, following count, and posts count
          if (d.profilePicUrl) {
            setProfilePics((prev) => ({ ...prev, [platform]: d.profilePicUrl }));
          }
          if (d.following) {
            setFollowingCounts((prev) => ({ ...prev, [platform]: d.following }));
          }
          if (d.posts) {
            setPostsCounts((prev) => ({ ...prev, [platform]: d.posts }));
          }

          setFetchStatuses((prev) => ({
            ...prev,
            [platform]: {
              loading: false,
              fetched: true,
              error: null,
              verificationTier: d.verificationTier,
              dataSourceProvider: d.dataSourceProvider,
            },
          }));
        } else {
          // Fetch failed — silent fallback to manual input (B6)
          setFetchStatuses((prev) => ({
            ...prev,
            [platform]: {
              loading: false,
              fetched: false,
              error: result.error.code === "PRIVATE_ACCOUNT"
                ? "Private account — enter numbers manually"
                : null, // Don't show errors for other failures
              verificationTier: null,
              dataSourceProvider: null,
            },
          }));
        }
      } catch {
        // Network error or unexpected failure — silent fallback (B6)
        setFetchStatuses((prev) => ({
          ...prev,
          [platform]: { loading: false, fetched: false, error: null, verificationTier: null, dataSourceProvider: null },
        }));
      }
    },
    [setValue, watch]
  );

  // ── Auto-fill for returning users ──
  useEffect(() => {
    async function loadExistingProfile() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: profile } = await supabase
          .from("creator_profiles")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        if (profile) {
          setIsReturningUser(true);
          setExistingProfileId(profile.id);

          setValue("name", profile.name || "");
          setValue("phone", profile.phone || "");
          setValue("niche", profile.niche || "");
          if (profile.engagement_rate)
            setValue("engagement_rate", Number(profile.engagement_rate));

          if (profile.avg_views_instagram)
            setValue("avgViewsInstagram", Number(profile.avg_views_instagram));
          if (profile.avg_views_youtube)
            setValue("avgViewsYoutube", Number(profile.avg_views_youtube));
          if (profile.avg_views_facebook)
            setValue("avgViewsFacebook", Number(profile.avg_views_facebook));

          // Find matching city
          if (profile.city_tier) {
            const matchedCity = Object.entries(cityTierMapping).find(
              ([, tier]) => tier === profile.city_tier
            );
            if (matchedCity) setValue("city", matchedCity[0]);
          }

          // Set platforms
          const platforms: FormValues["platforms"] = [];
          if (profile.followers_instagram) {
            platforms.push("instagram");
            setValue("followers_instagram", profile.followers_instagram);
          }
          if (profile.followers_youtube) {
            platforms.push("youtube");
            setValue("followers_youtube", profile.followers_youtube);
          }
          if (profile.followers_facebook) {
            platforms.push("facebook");
            setValue("followers_facebook", profile.followers_facebook);
          }
          if (platforms.length > 0) setValue("platforms", platforms);
        }
      } catch {
        // Not logged in or no profile — fine, start fresh
      }
    }
    loadExistingProfile();
  }, [setValue]);

  // ── Step validation ──
  const validateStep = async () => {
    switch (currentStep) {
      case 1:
        return trigger(["name", "city", "phone"]);
      case 2: {
        const platformValid = await trigger("platforms");
        if (!platformValid) return false;
        // Validate follower counts for selected platforms
        let allValid = true;
        for (const p of selectedPlatforms) {
          const field = `followers_${p}` as "followers_instagram" | "followers_youtube" | "followers_facebook";
          const val = watch(field);
          if (val === undefined || val === null || isNaN(Number(val)) || Number(val) < 1000) {
            setError(field, {
              type: "manual",
              message: "Follower count is required and must be at least 1,000",
            });
            allValid = false;
          } else {
            clearErrors(field);
          }
        }
        return allValid;
      }
      case 3:
        return trigger("niche");
      case 4:
        return trigger(["engagement_rate", "avgViewsInstagram", "avgViewsYoutube", "avgViewsFacebook"]);
      default:
        return true;
    }
  };

  const nextStep = async () => {
    const valid = await validateStep();
    if (valid && currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  // ── Submit ──
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const cityTier = cityTierMapping[data.city] || "tier_3";
      const engagementSkipped =
        data.engagement_rate === null || data.engagement_rate === undefined;

      // Check if user is logged in
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Determine verification tier from auto-fetch results
      const verificationTier = autoVerificationTier || "self_reported";
      const dataSource = autoDataSource || "manual";

      const primaryPlatform = data.platforms[0];
      const profilePicUrl = primaryPlatform ? profilePics[primaryPlatform] : null;

      const profileData = {
        name: data.name,
        phone: data.phone || null,
        niche: data.niche,
        city: data.city,
        city_tier: cityTier,
        instagram_handle: data.handle_instagram || null,
        youtube_handle: data.handle_youtube || null,
        facebook_handle: data.handle_facebook || null,
        followers_instagram: data.platforms.includes("instagram") ? data.followers_instagram : null,
        followers_youtube: data.platforms.includes("youtube") ? data.followers_youtube : null,
        followers_facebook: data.platforms.includes("facebook") ? data.followers_facebook : null,
        following_instagram: data.platforms.includes("instagram") ? (followingCounts.instagram || null) : null,
        following_youtube: data.platforms.includes("youtube") ? (followingCounts.youtube || null) : null,
        following_facebook: data.platforms.includes("facebook") ? (followingCounts.facebook || null) : null,
        posts_instagram: data.platforms.includes("instagram") ? (postsCounts.instagram || null) : null,
        posts_youtube: data.platforms.includes("youtube") ? (postsCounts.youtube || null) : null,
        posts_facebook: data.platforms.includes("facebook") ? (postsCounts.facebook || null) : null,
        engagement_rate: data.engagement_rate ?? null,
        engagement_source: autoVerificationTier || "self_reported",
        verification_tier: verificationTier,
        data_source_provider: dataSource,
        user_id: session?.user?.id || null,
        updated_at: new Date().toISOString(),
        avg_views_instagram: data.platforms.includes("instagram") ? (data.avgViewsInstagram ?? null) : null,
        avg_views_youtube: data.platforms.includes("youtube") ? (data.avgViewsYoutube ?? null) : null,
        avg_views_facebook: data.platforms.includes("facebook") ? (data.avgViewsFacebook ?? null) : null,
        profile_pic_url: profilePicUrl || null,
      };

      let profileId = existingProfileId;

      if (existingProfileId) {
        // Update existing profile
        await supabase
          .from("creator_profiles")
          .update(profileData)
          .eq("id", existingProfileId);
      } else {
        // Insert new profile
        const { data: newProfile, error } = await supabase
          .from("creator_profiles")
          .insert(profileData)
          .select("id")
          .single();

        if (error) throw error;
        profileId = newProfile.id;
      }

      // If engagement was skipped, add to admin review queue
      if (engagementSkipped && profileId) {
        await supabase.from("admin_review_queue").insert({
          creator_id: profileId,
          status: "pending",
        });
      }

      // Calculate rates for history
      const rateInput = {
        platforms: {
          instagram: data.platforms.includes("instagram") ? data.followers_instagram : undefined,
          youtube: data.platforms.includes("youtube") ? data.followers_youtube : undefined,
          facebook: data.platforms.includes("facebook") ? data.followers_facebook : undefined,
        },
        niche: data.niche,
        cityTier,
        engagementRate: data.engagement_rate,
        avgViewsInstagram: data.avgViewsInstagram ?? null,
        avgViewsYoutube: data.avgViewsYoutube ?? null,
        avgViewsFacebook: data.avgViewsFacebook ?? null,
      };
      const computedRates = calculateRates(rateInput);

      // Save to calculations history if logged in
      if (session?.user?.id) {
        try {
          await supabase.from("rate_calculations").insert({
            user_id: session.user.id,
            creator_name: data.name,
            niche: data.niche,
            city: data.city,
            city_tier: cityTier,
            verification_tier: verificationTier,
            platforms: data.platforms,
            followers_instagram: data.followers_instagram || null,
            followers_youtube: data.followers_youtube || null,
            followers_facebook: data.followers_facebook || null,
            instagram_handle: data.handle_instagram || null,
            youtube_handle: data.handle_youtube || null,
            facebook_handle: data.handle_facebook || null,
            profile_pic_url: profilePicUrl || null,
            following_instagram: data.platforms.includes("instagram") ? (followingCounts.instagram || null) : null,
            following_youtube: data.platforms.includes("youtube") ? (followingCounts.youtube || null) : null,
            following_facebook: data.platforms.includes("facebook") ? (followingCounts.facebook || null) : null,
            posts_instagram: data.platforms.includes("instagram") ? (postsCounts.instagram || null) : null,
            posts_youtube: data.platforms.includes("youtube") ? (postsCounts.youtube || null) : null,
            posts_facebook: data.platforms.includes("facebook") ? (postsCounts.facebook || null) : null,
            engagement_rate: data.engagement_rate ?? null,
            avg_views_instagram: data.avgViewsInstagram || null,
            avg_views_youtube: data.avgViewsYoutube || null,
            avg_views_facebook: data.avgViewsFacebook || null,
            results_json: computedRates,
          });
        } catch (historyErr) {
          console.error("Failed to save history:", historyErr);
        }
      }

      // Store calculation inputs in sessionStorage for the results page
      const calcInput = {
        profileId,
        platforms: data.platforms,
        followersInstagram: data.followers_instagram,
        followersYoutube: data.followers_youtube,
        followersFacebook: data.followers_facebook,
        handleInstagram: data.handle_instagram || null,
        handleYoutube: data.handle_youtube || null,
        handleFacebook: data.handle_facebook || null,
        followingInstagram: data.platforms.includes("instagram") ? (followingCounts.instagram || null) : null,
        followingYoutube: data.platforms.includes("youtube") ? (followingCounts.youtube || null) : null,
        followingFacebook: data.platforms.includes("facebook") ? (followingCounts.facebook || null) : null,
        postsInstagram: data.platforms.includes("instagram") ? (postsCounts.instagram || null) : null,
        postsYoutube: data.platforms.includes("youtube") ? (postsCounts.youtube || null) : null,
        postsFacebook: data.platforms.includes("facebook") ? (postsCounts.facebook || null) : null,
        niche: data.niche,
        city: data.city,
        cityTier,
        engagementRate: data.engagement_rate,
        creatorName: data.name,
        engagementSkipped,
        verificationTier: autoVerificationTier || "self_reported",
        calculatedAt: new Date().toISOString(),
        avgViewsInstagram: data.avgViewsInstagram || null,
        avgViewsYoutube: data.avgViewsYoutube || null,
        avgViewsFacebook: data.avgViewsFacebook || null,
        profilePicUrl: profilePicUrl || null,
      };
      sessionStorage.setItem("mc_calc_input", JSON.stringify(calcInput));

      router.push("/results");
    } catch (error) {
      console.error("Submission error:", error);
      // If Supabase fails, still show results with local data
      const cityTier = cityTierMapping[data.city] || "tier_3";
      const calcInput = {
        profileId: null,
        platforms: data.platforms,
        followersInstagram: data.followers_instagram,
        followersYoutube: data.followers_youtube,
        followersFacebook: data.followers_facebook,
        niche: data.niche,
        city: data.city,
        cityTier,
        engagementRate: data.engagement_rate,
        creatorName: data.name,
        engagementSkipped:
          data.engagement_rate === null || data.engagement_rate === undefined,
        verificationTier: autoVerificationTier || "self_reported",
        calculatedAt: new Date().toISOString(),
        avgViewsInstagram: data.avgViewsInstagram || null,
        avgViewsYoutube: data.avgViewsYoutube || null,
        avgViewsFacebook: data.avgViewsFacebook || null,
      };
      sessionStorage.setItem("mc_calc_input", JSON.stringify(calcInput));
      router.push("/results");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Returning user banner */}
      {isReturningUser && (
        <div className="glass p-4 rounded-xl flex items-center gap-3 animate-fade-in opacity-0">
          <span className="text-xl">👋</span>
          <div>
            <p className="text-sm font-medium">Welcome back!</p>
            <p className="text-xs text-[--mc-text-secondary]">
              We&apos;ve pre-filled your last details. Update anything that&apos;s
              changed, or just hit Recalculate.
            </p>
          </div>
        </div>
      )}

      {/* ── Step Indicator ── */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
          <div key={step} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => step < currentStep && setCurrentStep(step)}
              className={`mc-step ${
                step === currentStep
                  ? "mc-step-active"
                  : step < currentStep
                  ? "mc-step-completed"
                  : "mc-step-upcoming"
              }`}
            >
              {step < currentStep ? "✓" : step}
            </button>
            {step < TOTAL_STEPS && (
              <div
                className={`w-8 h-0.5 ${
                  step < currentStep
                    ? "bg-[--mc-success]"
                    : "bg-[--mc-bg-elevated]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Basic Info ── */}
      {currentStep === 1 && (
        <div className="mc-card p-8 animate-fade-in opacity-0 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Basic Info</h2>
            <p className="text-sm text-[--mc-text-muted]">
              Tell us about yourself
            </p>
          </div>

          <div>
            <label htmlFor="name" className="mc-label">
              Name *
            </label>
            <input
              id="name"
              type="text"
              placeholder="Your name or brand name"
              className={`mc-input ${errors.name ? "mc-input-error" : ""}`}
              {...register("name")}
            />
            {errors.name && (
              <p className="mc-error-text">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="mc-label">
              Phone Number{" "}
              <span className="text-[--mc-text-muted]">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="+91 98765 43210"
              className="mc-input"
              {...register("phone")}
            />
            {errors.phone && (
              <p className="mc-error-text mt-1">{errors.phone.message}</p>
            )}
            <p className="text-xs text-[--mc-text-muted] mt-1">
              Used for OTP login later — not required now
            </p>
          </div>

          <div>
            <label htmlFor="city" className="mc-label">
              City *
            </label>
            <select
              id="city"
              className={`mc-select ${errors.city ? "mc-input-error" : ""}`}
              {...register("city")}
            >
              <option value="">Select your city</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}{" "}
                  {city !== "Other"
                    ? `(${cityTierMapping[city].replace("_", " ")})`
                    : "(Tier 3)"}
                </option>
              ))}
            </select>
            {errors.city && (
              <p className="mc-error-text">{errors.city.message}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Platform Selection ── */}
      {currentStep === 2 && (
        <div className="mc-card p-8 animate-fade-in opacity-0 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">
              Platforms & Followers
            </h2>
            <p className="text-sm text-[--mc-text-muted]">
              Select your active platforms and enter follower counts
            </p>
          </div>

          <Controller
            name="platforms"
            control={control}
            render={({ field }) => (
              <div className="space-y-3">
                {PLATFORM_OPTIONS.map((platform) => {
                  const isSelected = field.value?.includes(platform.value);
                  return (
                    <div key={platform.value}>
                      <button
                        type="button"
                        className={`mc-checkbox-card w-full ${
                          isSelected ? "active" : ""
                        }`}
                        onClick={() => {
                          const current = field.value || [];
                          if (isSelected) {
                            field.onChange(
                              current.filter((v) => v !== platform.value)
                            );
                          } else {
                            field.onChange([...current, platform.value]);
                          }
                        }}
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-[--mc-primary] border-[--mc-primary]"
                              : "border-[--mc-text-muted]"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xl">{platform.icon}</span>
                        <span
                          className="font-medium"
                          style={{ color: isSelected ? platform.color : undefined }}
                        >
                          {platform.label}
                        </span>
                      </button>

                      {/* Handle + Follower inputs — shown when platform selected */}
                      {isSelected && (
                        <div className="mt-3 ml-4 sm:ml-12 animate-fade-in opacity-0 space-y-4">
                          {/* Handle input with auto-fetch on blur */}
                          <div>
                            <label
                              htmlFor={`handle_${platform.value}`}
                              className="mc-label"
                            >
                              {platform.label} Handle
                              <span className="text-[--mc-text-muted]"> (optional — enables auto-fill)</span>
                            </label>
                            <div className="relative">
                              <input
                                id={`handle_${platform.value}`}
                                type="text"
                                placeholder={platform.handlePlaceholder}
                                className="mc-input"
                                {...register(
                                  `handle_${platform.value}` as
                                    | "handle_instagram"
                                    | "handle_youtube"
                                    | "handle_facebook"
                                )}
                                onBlur={(e) => {
                                  const handle = e.target.value.trim();
                                  if (handle) {
                                    handleAutoFetch(platform.value, handle);
                                  }
                                }}
                              />
                              {fetchStatuses[platform.value]?.loading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <svg className="animate-spin h-4 w-4 text-[--mc-primary]" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            {/* Fetch status feedback */}
                            {fetchStatuses[platform.value]?.fetched && (
                              <p className="text-xs text-[--mc-success] mt-1 flex items-center gap-1">
                                ✓ Auto-filled from public profile
                                <span className="ml-1 mc-badge mc-badge-teal" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                  {platform.value === 'youtube' ? '~ YouTube Data' : '~ Public Data'}
                                </span>
                              </p>
                            )}
                            {fetchStatuses[platform.value]?.error && (
                              <p className="text-xs text-[--mc-warning] mt-1">
                                {fetchStatuses[platform.value].error}
                              </p>
                            )}
                          </div>

                          {/* Follower count — auto-filled or manual */}
                          <div>
                            <label
                              htmlFor={`followers_${platform.value}`}
                              className="mc-label flex items-center gap-2"
                            >
                              {platform.label} Followers *
                              {fetchStatuses[platform.value]?.fetched && (
                                <span className="text-xs text-[--mc-success] font-normal">(auto-filled — editable)</span>
                              )}
                            </label>
                            <input
                              id={`followers_${platform.value}`}
                              type="number"
                              min={1000}
                              placeholder="e.g. 25000 (minimum 1,000)"
                              className="mc-input"
                              {...register(
                                `followers_${platform.value}` as
                                  | "followers_instagram"
                                  | "followers_youtube"
                                  | "followers_facebook",
                                { valueAsNumber: true }
                              )}
                            />
                            {errors[`followers_${platform.value}` as keyof FormValues] && (
                              <p className="mc-error-text mt-1">
                                {errors[`followers_${platform.value}` as keyof FormValues]?.message}
                              </p>
                            )}
                            <p className="text-xs text-[--mc-text-muted] mt-1">
                              Minimum 1,000 followers required
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          />
          {errors.platforms && (
            <p className="mc-error-text">{errors.platforms.message}</p>
          )}
        </div>
      )}

      {/* ── Step 3: Niche ── */}
      {currentStep === 3 && (
        <div className="mc-card p-8 animate-fade-in opacity-0 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Content Niche</h2>
            <p className="text-sm text-[--mc-text-muted]">
              Your niche affects pricing — premium niches command higher rates
            </p>
          </div>

          <Controller
            name="niche"
            control={control}
            render={({ field }) => (
              <div className="space-y-3">
                {nicheOptions.map((niche) => {
                  const isSelected = field.value === niche;
                  return (
                    <button
                      key={niche}
                      type="button"
                      className="mc-checkbox-card w-full"
                      style={{
                        borderColor: isSelected ? "var(--mc-primary)" : undefined,
                        background: isSelected
                          ? "rgba(108, 92, 231, 0.15)"
                          : undefined,
                        boxShadow: isSelected
                          ? "0 0 0 1px var(--mc-primary), 0 0 20px rgba(108, 92, 231, 0.1)"
                          : undefined,
                      }}
                      onClick={() => field.onChange(niche)}
                    >
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0"
                        style={{
                          borderColor: isSelected
                            ? "var(--mc-primary)"
                            : "var(--mc-text-muted)",
                          background: isSelected ? "var(--mc-primary)" : "transparent",
                        }}
                      >
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                      <span
                        className="font-medium"
                        style={{
                          color: isSelected ? "var(--mc-text-primary)" : "var(--mc-text-secondary)",
                        }}
                      >
                        {niche.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </span>
                      {isSelected && (
                        <span className="ml-auto text-xs font-semibold text-[--mc-primary-light]">
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {errors.niche && (
            <p className="mc-error-text">{errors.niche.message}</p>
          )}
        </div>
      )}

      {/* ── Step 4: Engagement Rate ── */}
      {currentStep === 4 && (
        <div className="mc-card p-8 animate-fade-in opacity-0 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">
              Engagement Rate{" "}
              <span className="text-sm font-normal text-[--mc-text-muted]">
                (optional)
              </span>
            </h2>
            <p className="text-sm text-[--mc-text-muted]">
              Don&apos;t know it? Skip this — we&apos;ll calculate it for you
              within 24–48 hours.
            </p>
          </div>

          <div>
            <label htmlFor="engagement_rate" className="mc-label">
              Engagement Rate (%)
            </label>
            <input
              id="engagement_rate"
              type="number"
              step="0.1"
              min={0}
              max={100}
              placeholder="e.g. 4.5"
              className="mc-input"
              {...register("engagement_rate", {
                setValueAs: (v) => {
                  if (v === "" || v === undefined || v === null) return null;
                  const parsed = parseFloat(v);
                  return isNaN(parsed) ? null : parsed;
                }
              })}
            />
            {errors.engagement_rate && (
              <p className="mc-error-text mt-1">{errors.engagement_rate.message}</p>
            )}

            {/* Show if Instagram was selected */}
            {selectedPlatforms.includes("instagram") && (
              <div className="mt-4">
                <label className="mc-label">Avg Reel Views — Optional</label>
                <input
                  type="number"
                  placeholder="e.g. 1200"
                  className="mc-input"
                  {...register("avgViewsInstagram", {
                    setValueAs: (v) => {
                      if (v === "" || v === undefined || v === null) return null;
                      const parsed = parseInt(v, 10);
                      return isNaN(parsed) ? null : parsed;
                    }
                  })}
                />
                {errors.avgViewsInstagram && (
                  <p className="mc-error-text mt-1">{errors.avgViewsInstagram.message}</p>
                )}
                <p className="text-xs text-[--mc-text-muted] mt-1">
                  Open your last 10 Reels, average the view counts.
                  This makes your rate card significantly more accurate.
                </p>
              </div>
            )}

            {/* Show if YouTube was selected */}
            {selectedPlatforms.includes("youtube") && (
              <div className="mt-4">
                <label className="mc-label">Avg YouTube Video Views — Optional</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  className="mc-input"
                  {...register("avgViewsYoutube", {
                    setValueAs: (v) => {
                      if (v === "" || v === undefined || v === null) return null;
                      const parsed = parseInt(v, 10);
                      return isNaN(parsed) ? null : parsed;
                    }
                  })}
                />
                {errors.avgViewsYoutube && (
                  <p className="mc-error-text mt-1">{errors.avgViewsYoutube.message}</p>
                )}
              </div>
            )}

            {/* Show if Facebook was selected */}
            {selectedPlatforms.includes("facebook") && (
              <div className="mt-4">
                <label className="mc-label">Avg Facebook Post Reach — Optional</label>
                <input
                  type="number"
                  placeholder="e.g. 800"
                  className="mc-input"
                  {...register("avgViewsFacebook", {
                    setValueAs: (v) => {
                      if (v === "" || v === undefined || v === null) return null;
                      const parsed = parseInt(v, 10);
                      return isNaN(parsed) ? null : parsed;
                    }
                  })}
                />
                {errors.avgViewsFacebook && (
                  <p className="mc-error-text mt-1">{errors.avgViewsFacebook.message}</p>
                )}
              </div>
            )}

            <div className="mt-4 glass p-4 rounded-lg">
              <p className="text-sm text-[--mc-text-secondary] leading-relaxed">
                💡 <strong>How to calculate:</strong> Take your last 10–20
                posts. Add up likes + comments. Divide by follower count.
                Multiply by 100.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Review & Submit ── */}
      {currentStep === 5 && (
        <div className="mc-card p-8 animate-fade-in opacity-0 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Review & Calculate</h2>
            <p className="text-sm text-[--mc-text-muted]">
              Confirm your details and get your rate card
            </p>
          </div>

          <div className="space-y-4">
            <ReviewRow label="Name" value={watch("name")} />
            <ReviewRow
              label="City"
              value={`${watch("city")} (${
                cityTierMapping[watch("city")]?.replace("_", " ") || "—"
              })`}
            />
            <ReviewRow
              label="Platforms"
              value={selectedPlatforms
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                .join(", ")}
            />
            {selectedPlatforms.includes("instagram") && (
              <ReviewRow
                label="Instagram Followers"
                value={watch("followers_instagram")?.toLocaleString("en-IN") || "—"}
              />
            )}
            {selectedPlatforms.includes("youtube") && (
              <ReviewRow
                label="YouTube Followers"
                value={watch("followers_youtube")?.toLocaleString("en-IN") || "—"}
              />
            )}
            {selectedPlatforms.includes("facebook") && (
              <ReviewRow
                label="Facebook Followers"
                value={watch("followers_facebook")?.toLocaleString("en-IN") || "—"}
              />
            )}
            <ReviewRow label="Niche" value={watch("niche")?.replace(/_/g, " ")?.replace(/\b\w/g, (l: string) => l.toUpperCase()) || "—"} />
            <ReviewRow
              label="Engagement Rate"
              value={
                watch("engagement_rate")
                  ? `${watch("engagement_rate")}%`
                  : "Pending manual review"
              }
            />
          </div>
        </div>
      )}

      {/* ── Navigation Buttons ── */}
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={prevStep}
          className={`mc-btn mc-btn-secondary ${
            currentStep === 1 ? "invisible" : ""
          }`}
        >
          ← Back
        </button>

        {currentStep < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={nextStep}
            className="mc-btn mc-btn-primary"
          >
            Continue →
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting}
            className="mc-btn mc-btn-primary mc-btn-lg relative"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Calculating...
              </span>
            ) : isReturningUser ? (
              "Recalculate My Rate →"
            ) : (
              "Calculate My Rate →"
            )}
          </button>
        )}
      </div>
    </form>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-[--mc-border] last:border-0">
      <span className="text-sm text-[--mc-text-secondary]">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}
