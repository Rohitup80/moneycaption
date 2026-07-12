"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { nicheOptions, cityOptions, cityTierMapping, NICHE_MULTIPLIERS } from "@/lib/rate-config";
import ScreenshotUploadModal from "../results/ScreenshotUploadModal";
import Navbar from "@/components/Navbar";

// Untyped client to avoid generics mismatch with current supabase-js version
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CreatorProfile = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RateCalculation = Record<string, any>;

type AuthView = "login" | "signup" | "dashboard" | "pending_approval" | "forgot_password" | "reset_password";

export default function ProfilePage() {
  const router = useRouter();
  const [view, setView] = useState<AuthView>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Auth form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");

  // Dashboard & profile states
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [history, setHistory] = useState<RateCalculation[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [shareCopied, setShareCopied] = useState(false);
  const [instantReviewRequested, setInstantReviewRequested] = useState(false);

  // Password visibility states
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [showConfirmPasswordText, setShowConfirmPasswordText] = useState(false);

  // Forgot password inputs
  const [forgotEmail, setForgotEmail] = useState("");
  // Reset password inputs
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Change password inputs (on Dashboard details panel)
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordSuccess, setChangePasswordSuccess] = useState("");
  const [dashboardNewPassword, setDashboardNewPassword] = useState("");
  const [showDashboardPassword, setShowDashboardPassword] = useState(false);
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});

  // Profile verification & email resend
  const [profileVerifyLoading, setProfileVerifyLoading] = useState(false);
  const [resendVerifyLoading, setResendVerifyLoading] = useState(false);

  const handleCopyShareLink = () => {
    if (!profile) return;
    if (profile.approval_status === "pending") {
      alert("⚠️ Account Pending Approval: You cannot share or copy your public rate card link until the administrator approves your profile.");
      return;
    }
    const shareUrl = `${window.location.origin}/share/${profile.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  async function handleRequestInstantReview() {
    if (!profile) return;
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/send-approval-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorName: profile.name,
          creatorEmail: profile.email,
          niche: profile.niche,
          city: profile.city || "Not provided",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInstantReviewRequested(true);
        setSuccessMsg("Instant review requested successfully! The administrator has been notified.");
        
        await supabase
          .from("creator_profiles")
          .update({ quick_review_requested: true })
          .eq("id", profile.id);
        
        setProfile((prev: any) => prev ? { ...prev, quick_review_requested: true } : null);
      } else {
        setError(data.error || "Failed to request instant review.");
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred while requesting instant review.");
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot Password Send Simulation ──
  async function handleSendResetPassword() {
    if (!forgotEmail) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/send-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Password reset link has been sent! Check your console logs.");
        setTimeout(() => setView("login"), 4500);
      } else {
        setError(data.error || "Failed to request password reset.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to request password reset.");
    } finally {
      setLoading(false);
    }
  }

  // ── Execute Password Reset via Supabase ──
  async function handleExecuteResetPassword() {
    if (!newPassword || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const { error: resetError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (resetError) throw resetError;
      setSuccessMsg("Password reset successfully! You can now log in with your new password.");
      setTimeout(() => setView("login"), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  // ── Change Password inside Dashboard ──
  async function handleDashboardChangePassword() {
    if (!dashboardNewPassword) {
      setChangePasswordError("Please enter a new password.");
      return;
    }
    if (dashboardNewPassword.length < 6) {
      setChangePasswordError("Password must be at least 6 characters.");
      return;
    }
    setChangePasswordLoading(true);
    setChangePasswordError("");
    setChangePasswordSuccess("");
    try {
      const { error: changeErr } = await supabase.auth.updateUser({
        password: dashboardNewPassword,
      });
      if (changeErr) throw changeErr;
      setChangePasswordSuccess("Password changed successfully!");
      setDashboardNewPassword("");
    } catch (err: any) {
      console.error(err);
      setChangePasswordError(err.message || "Failed to change password.");
    } finally {
      setChangePasswordLoading(false);
    }
  }

  // ── Resend Verification Email Simulation ──
  async function handleResendVerification(emailAddress: string) {
    if (!emailAddress) {
      setError("Please enter your email address to resend the verification link.");
      return;
    }
    setResendVerifyLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddress, name: "Creator" }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Verification link resent! Check terminal logs.");
      } else {
        setError(data.error || "Failed to resend verification.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to resend verification email.");
    } finally {
      setResendVerifyLoading(false);
    }
  }

  // ── Request Instant Profile Verification (Verification Badge) ──
  async function handleRequestProfileVerification() {
    if (!profile) return;
    if (!profile.screenshot_url) {
      setError("Please upload a verification screenshot first.");
      return;
    }
    setProfileVerifyLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/send-verification-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorName: profile.name,
          creatorEmail: profile.email,
          platforms: [
            profile.instagram_handle ? "Instagram" : "",
            profile.youtube_handle ? "YouTube" : "",
            profile.facebook_handle ? "Facebook" : ""
          ].filter(Boolean),
          screenshotUrl: profile.screenshot_url
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Profile verification request sent to admin! Verification pending review.");
        await supabase
          .from("creator_profiles")
          .update({ profile_verification_requested: true })
          .eq("id", profile.id);
        setProfile({ ...profile, profile_verification_requested: true });
      } else {
        setError(data.error || "Failed to submit verification request.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to submit verification request.");
    } finally {
      setProfileVerifyLoading(false);
    }
  }

  // ── Delete Calculation History Item ──
  async function handleDeleteHistory(historyId: string) {
    if (!confirm("Are you sure you want to delete this calculation from your history?")) return;
    setLoading(true);
    try {
      const { error: delErr } = await supabase
        .from("rate_calculations")
        .delete()
        .eq("id", historyId);
      if (delErr) throw delErr;
      
      // Update statistics: deletes_count
      if (profile) {
        const { data: prof } = await supabase
          .from("creator_profiles")
          .select("deletes_count")
          .eq("id", profile.id)
          .single();
        await supabase
          .from("creator_profiles")
          .update({ deletes_count: (prof?.deletes_count || 0) + 1 })
          .eq("id", profile.id);
        setProfile({ ...profile, deletes_count: (prof?.deletes_count || 0) + 1 });
      }

      setHistory(history.filter((item) => item.id !== historyId));
      setSuccessMsg("Calculation history item deleted successfully!");
    } catch (err) {
      console.error(err);
      setError("Failed to delete history item.");
    } finally {
      setLoading(false);
    }
  }

  // Platform verification states
  const [verifyingPlatform, setVerifyingPlatform] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Edit form states
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNiche, setEditNiche] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editInstagram, setEditInstagram] = useState("");
  const [editYoutube, setEditYoutube] = useState("");
  const [editFacebook, setEditFacebook] = useState("");
  const [editFollowersInstagram, setEditFollowersInstagram] = useState("");
  const [editFollowersYoutube, setEditFollowersYoutube] = useState("");
  const [editFollowersFacebook, setEditFollowersFacebook] = useState("");

  // Check session on load
  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await linkPastCalculations(session.user.id);
        setUserId(session.user.id);
        setView("dashboard");
        loadProfileAndHistory(session.user.id);
      }
    }
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await linkPastCalculations(session.user.id);
        setUserId(session.user.id);
        setView("dashboard");
        loadProfileAndHistory(session.user.id);
      } else {
        setUserId(null);
        setProfile(null);
        setHistory([]);
        setView("login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("view");
      const verified = params.get("verified");
      const emailParam = params.get("email");
      const reset = params.get("reset");

      if (verified === "true" && emailParam) {
        setSuccessMsg(`Email ${emailParam} verified successfully! Your profile is pending admin approval.`);
        setView("login");
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (reset === "true" && emailParam) {
        setResetEmail(emailParam);
        setView("reset_password");
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (mode === "signup") {
        setView("signup");
      } else if (mode === "login") {
        setView("login");
      }
    }
  }, []);

  async function loadProfileAndHistory(uid: string) {
    setLoading(true);
    try {
      // Load profile
      const { data: profileData } = await supabase
        .from("creator_profiles")
        .select("*")
        .eq("user_id", uid)
        .single();

      if (profileData) {
        // Enforce creator account approval check
        if (profileData.approval_status === "rejected") {
          await supabase.auth.signOut();
          setUserId(null);
          setProfile(null);
          setHistory([]);
          setView("login");
          setError("Your account has been rejected by the admin. You cannot log in.");
          setLoading(false);
          return;
        }

        setProfile(profileData);
        setUserId(uid);
        setView("dashboard");
        setEditName(profileData.name || "");
        setEditPhone(profileData.phone || "");
        setEditNiche(profileData.niche || "");
        setEditCity(profileData.city || "");
        setEditInstagram(profileData.instagram_handle || "");
        setEditYoutube(profileData.youtube_handle || "");
        setEditFacebook(profileData.facebook_handle || "");
        setEditFollowersInstagram(profileData.followers_instagram?.toString() || "");
        setEditFollowersYoutube(profileData.followers_youtube?.toString() || "");
        setEditFollowersFacebook(profileData.followers_facebook?.toString() || "");
      }

      // Load calculation history
      const { data: historyData } = await supabase
        .from("rate_calculations")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (historyData) {
        setHistory(historyData);
      }

      // Load active rate cards from rate_cards table
      if (profileData) {
        const { data: cardsData } = await supabase
          .from("rate_cards")
          .select("*")
          .eq("creator_id", profileData.id);
        if (cardsData) {
          setSavedCards(cardsData);
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Helper to link any anonymous calculations stored in sessionStorage
  async function linkPastCalculations(userId: string) {
    const stored = sessionStorage.getItem("mc_calc_input");
    if (!stored) return;
    try {
      const calcData = JSON.parse(stored);
      const { calculateRates } = await import("@/lib/rate-engine");
      const computedRates = calculateRates({
        platforms: {
          instagram: calcData.platforms.includes("instagram") ? calcData.followersInstagram : undefined,
          youtube: calcData.platforms.includes("youtube") ? calcData.followersYoutube : undefined,
          facebook: calcData.platforms.includes("facebook") ? calcData.followersFacebook : undefined,
        },
        niche: calcData.niche,
        cityTier: calcData.cityTier,
        engagementRate: calcData.engagementRate,
        avgViewsInstagram: calcData.avgViewsInstagram ?? null,
        avgViewsYoutube: calcData.avgViewsYoutube ?? null,
        avgViewsFacebook: calcData.avgViewsFacebook ?? null,
      });

      // 1. Save calculation history
      const { error: historyError } = await supabase.from("rate_calculations").insert({
        user_id: userId,
        creator_name: calcData.creatorName,
        niche: calcData.niche,
        city: calcData.city || null,
        city_tier: calcData.cityTier,
        verification_tier: calcData.verificationTier,
        platforms: calcData.platforms,
        followers_instagram: calcData.followersInstagram || null,
        followers_youtube: calcData.followersYoutube || null,
        followers_facebook: calcData.followersFacebook || null,
        instagram_handle: calcData.handleInstagram || null,
        youtube_handle: calcData.handleYoutube || null,
        facebook_handle: calcData.handleFacebook || null,
        profile_pic_url: calcData.profilePicUrl || null,
        following_instagram: calcData.followingInstagram || null,
        following_youtube: calcData.followingYoutube || null,
        following_facebook: calcData.followingFacebook || null,
        posts_instagram: calcData.postsInstagram || null,
        posts_youtube: calcData.postsYoutube || null,
        posts_facebook: calcData.postsFacebook || null,
        engagement_rate: calcData.engagementRate ?? null,
        avg_views_instagram: calcData.avgViewsInstagram || null,
        avg_views_youtube: calcData.avgViewsYoutube || null,
        avg_views_facebook: calcData.avgViewsFacebook || null,
        results_json: computedRates,
      });
      if (historyError) {
        console.error("Database error saving linked rate calculation:", historyError);
      }

      // 2. Resolve creator profile ID
      let profileId = calcData.profileId;
      if (!profileId) {
        const { data: profile } = await supabase
          .from("creator_profiles")
          .select("id")
          .eq("user_id", userId)
          .single();
        if (profile) {
          profileId = profile.id;
        } else {
          // Create baseline profile if not found
          const { data: newProfile } = await supabase
            .from("creator_profiles")
            .insert({
              user_id: userId,
              name: calcData.creatorName,
              niche: calcData.niche,
              city_tier: calcData.cityTier,
              verification_tier: calcData.verificationTier,
              instagram_handle: calcData.handleInstagram || null,
              youtube_handle: calcData.handleYoutube || null,
              facebook_handle: calcData.handleFacebook || null,
              followers_instagram: calcData.followersInstagram || null,
              followers_youtube: calcData.followersYoutube || null,
              followers_facebook: calcData.followersFacebook || null,
            })
            .select("id")
            .single();
          if (newProfile) {
            profileId = newProfile.id;
          }
        }
      }

      // 3. Save rate cards
      if (profileId) {
        const { applyPriceSelection, flattenForDatabase } = await import("@/lib/rate-engine");
        const selections: Record<string, "marketStandard"> = {};
        computedRates.forEach((platform) => {
          platform.deliverables.forEach((d) => {
            selections[d.id] = "marketStandard";
          });
        });
        const resultsWithSelections = applyPriceSelection(computedRates, selections);
        const rows = flattenForDatabase(profileId, resultsWithSelections);
        await supabase.from("rate_cards").delete().eq("creator_id", profileId);
        await supabase.from("rate_cards").insert(rows);
      }

      // Clear after linking
      sessionStorage.removeItem("mc_calc_input");
    } catch (linkErr) {
      console.error("Failed to link past calculation:", linkErr);
    }
  }

  // Request quick review from admin for uploaded screenshot
  async function handleRequestQuickReview() {
    if (!profile) return;
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const { error } = await supabase
        .from("creator_profiles")
        .update({ quick_review_requested: true })
        .eq("id", profile.id);

      if (error) throw error;
      setSuccessMsg("Quick review requested! Admin has been notified.");
      if (userId) loadProfileAndHistory(userId);
    } catch (err) {
      console.error("Failed to request quick review:", err);
      setError("Failed to request quick review. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Password Sign Up ──
  async function handleSignUp() {
    const errs: Record<string, string> = {};
    if (!fullName) errs.name = "Full name is required";
    if (!email) {
      errs.email = "Email address is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errs.email = "Please enter a valid email address with a domain (e.g. name@example.com)";
      }
    }
    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < 6) {
      errs.password = "Password must be at least 6 characters";
    }
    if (!niche) errs.niche = "Please select your niche";
    if (!city) errs.city = "Please select your city";

    if (phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        errs.phone = "Phone number must be exactly 10 digits";
      }
    }

    if (Object.keys(errs).length > 0) {
      setSignupErrors(errs);
      setError("Please fix the validation errors below.");
      return;
    }
    setSignupErrors({});

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      // 0. Prevent multi-signup on a single email ID
      const { data: existingProfile } = await supabase
        .from("creator_profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        setError("An account with this email address already exists.");
        setLoading(false);
        return;
      }

      // 1. Sign up the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Sign up failed. Please check your inputs.");
      }

      // 2. Create the creator profile row
      const cityTier = cityTierMapping[city] || "tier_3";
      const { error: profileError } = await supabase
        .from("creator_profiles")
        .insert({
          user_id: authData.user.id,
          name: fullName,
          email: email,
          phone: phone || null,
          niche: niche,
          city_tier: cityTier,
          verification_tier: "self_reported",
          engagement_source: "self_reported",
          approval_status: "pending", // New creator pending admin approval
        });

      if (profileError) {
        console.error("Failed to insert profile row:", profileError);
      }

      // 3. Send simulated verification email
      try {
        await fetch("/api/send-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name: fullName }),
        });
      } catch (mailErr) {
        console.error("Verification email simulation error:", mailErr);
      }

      setSuccessMsg("Registration successful! A simulated verification link has been sent. Check your console logs.");
      setTimeout(() => {
        setView("login");
      }, 4500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Password Login ──
  async function handleLogin() {
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Enforce email verification check
      if (data.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error("Please verify your email address before logging in. Check your inbox for the verification link.");
      }

      // Check account approval status
      if (data.user) {
        const { data: profileData, error: profileErr } = await supabase
          .from("creator_profiles")
          .select("approval_status")
          .eq("user_id", data.user.id)
          .single();

        if (profileErr) {
          console.error("Error loading profile status during login:", profileErr);
        } else if (profileData) {
          if (profileData.approval_status === "pending") {
            await supabase.auth.signOut();
            throw new Error("Your account is pending verification. The admin will review it shortly.");
          } else if (profileData.approval_status === "rejected") {
            await supabase.auth.signOut();
            throw new Error("Your account has been rejected by the admin. You cannot log in.");
          }
        }
      }

      setSuccessMsg("Logged in successfully!");
      if (data.user) {
        // Link any session storage calculations to their newly logged in profile
        await linkPastCalculations(data.user.id);
        setUserId(data.user.id);
        setView("dashboard");
        loadProfileAndHistory(data.user.id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Email OTP / Magic Link Login ──
  async function handleLoginWithMagicLink() {
    if (!email) {
      setError("Please enter your email.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + "/profile",
        },
      });

      if (authError) throw authError;

      setSuccessMsg("Check your email for a magic link to sign in!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Magic link request failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Update Profile Details ──
  async function handleUpdateProfile() {
    if (!editName || !editNiche || !editCity) {
      setError("Name, Niche, and City are required.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const cityTier = cityTierMapping[editCity] || "tier_3";
      const { error: updateError } = await supabase
        .from("creator_profiles")
        .update({
          name: editName,
          phone: editPhone || null,
          niche: editNiche,
          city: editCity,
          city_tier: cityTier,
          instagram_handle: editInstagram || null,
          youtube_handle: editYoutube || null,
          facebook_handle: editFacebook || null,
          followers_instagram: editFollowersInstagram ? parseInt(editFollowersInstagram, 10) : null,
          followers_youtube: editFollowersYoutube ? parseInt(editFollowersYoutube, 10) : null,
          followers_facebook: editFollowersFacebook ? parseInt(editFollowersFacebook, 10) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      setSuccessMsg("Profile details updated successfully!");
      setIsEditing(false);
      if (userId) loadProfileAndHistory(userId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Verify Social Handle (15-20 Seconds simulated delay) ──
  const handleVerifyHandle = async (platform: "instagram" | "youtube" | "facebook") => {
    const handle = platform === "instagram" ? editInstagram : platform === "youtube" ? editYoutube : editFacebook;
    if (!handle) {
      setVerifyError(`Please enter a ${platform} handle first.`);
      return;
    }
    const cleanHandle = handle.replace(/^@/, "").trim();
    if (!cleanHandle) return;

    setVerifyingPlatform(platform);
    setVerifyError(null);
    setVerifySuccess(null);

    // 17-second simulation delay
    const delayPromise = new Promise((resolve) => setTimeout(resolve, 17000));

    try {
      // 1. Fetch Profile Details (ER, Followers, Pic)
      const profileResponse = await fetch("/api/fetch-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle: cleanHandle }),
      });
      const profileResult = await profileResponse.json();
      if (!profileResult.success || !profileResult.data) {
        throw new Error(profileResult.error || `Could not resolve ${platform} profile details.`);
      }
      const d = profileResult.data;

      // 2. Fetch Posts for average metrics
      let fetchedAvgViews: number | null = null;
      let postsList: any[] = [];
      try {
        const postsResponse = await fetch("/api/fetch-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, handle: cleanHandle }),
        });
        const postsResult = await postsResponse.json();
        if (postsResult.success && postsResult.posts && postsResult.posts.length > 0) {
          const validPosts = postsResult.posts.filter((post: any) => post.views !== null);
          if (validPosts.length > 0) {
            fetchedAvgViews = Math.round(
              validPosts.reduce((sum: number, post: any) => sum + post.views, 0) / validPosts.length
            );
          }
          postsList = postsResult.posts;
        }
      } catch (err) {
        console.warn("Fetch posts error during verify:", err);
      }

      // Await simulation countdown
      await delayPromise;

      // Populate input states
      if (platform === "instagram") {
        setEditFollowersInstagram(d.followers.toString());
      } else if (platform === "youtube") {
        setEditFollowersYoutube(d.followers.toString());
      } else {
        setEditFollowersFacebook(d.followers.toString());
      }

      // Save directly to the database
      if (profile?.id) {
        const updates: any = {
          verification_tier: "api_verified",
          data_source_provider: d.dataSourceProvider || "scrapecreators",
          engagement_rate: d.engagementRate || null,
          engagement_source: "api_verified",
          profile_pic_url: d.profilePicUrl || profile.profile_pic_url,
          updated_at: new Date().toISOString(),
        };

        if (platform === "instagram") {
          updates.instagram_handle = cleanHandle;
          updates.followers_instagram = d.followers;
          updates.following_instagram = d.following || null;
          updates.posts_instagram = d.posts || null;
          updates.avg_views_instagram = fetchedAvgViews;
        } else if (platform === "youtube") {
          updates.youtube_handle = cleanHandle;
          updates.followers_youtube = d.followers;
          updates.following_youtube = d.following || null;
          updates.posts_youtube = d.posts || null;
          updates.avg_views_youtube = fetchedAvgViews;
        } else {
          updates.facebook_handle = cleanHandle;
          updates.followers_facebook = d.followers;
          updates.following_facebook = d.following || null;
          updates.posts_facebook = d.posts || null;
          updates.avg_views_facebook = fetchedAvgViews;
        }

        const { error: updateErr } = await supabase
          .from("creator_profiles")
          .update(updates)
          .eq("id", profile.id);

        if (updateErr) throw updateErr;

        // Cache posts in session storage
        if (postsList.length > 0) {
          sessionStorage.setItem("mc_fetched_posts", JSON.stringify(postsList));
        }

        // Reload local profile details
        const { data: refreshedProfile } = await supabase
          .from("creator_profiles")
          .select("*")
          .eq("id", profile.id)
          .single();
        if (refreshedProfile) {
          setProfile(refreshedProfile);
        }

        setVerifySuccess(`Successfully verified and saved ${platform} handle!`);
      }
    } catch (err: any) {
      console.error(err);
      setVerifyError(err.message || "Verification failed. Please try again.");
    } finally {
      setVerifyingPlatform(null);
    }
  };

  // ── View/Redownload a Past Calculation ──
  const handleViewPastCalculation = (calc: RateCalculation) => {
    const calcInput = {
      profileId: profile?.id || null,
      platforms: calc.platforms,
      followersInstagram: calc.followers_instagram,
      followersYoutube: calc.followers_youtube,
      followersFacebook: calc.followers_facebook,
      niche: calc.niche,
      cityTier: calc.city_tier,
      engagementRate: calc.engagement_rate,
      creatorName: calc.creator_name,
      engagementSkipped: calc.engagement_rate === null,
      verificationTier: calc.verification_tier,
      calculatedAt: calc.created_at,
    };
    sessionStorage.setItem("mc_calc_input", JSON.stringify(calcInput));
    router.push("/results");
  };

  async function handleLogout() {
    await supabase.auth.signOut();
    setView("login");
    setProfile(null);
    setHistory([]);
    setUserId(null);
  }

  const getVerificationBadge = (tier: string) => {
    switch (tier) {
      case "auto_fetched_public":
        return <span className="mc-badge mc-badge-teal">~ Public Data Match</span>;
      case "auto_fetched_youtube":
        return <span className="mc-badge mc-badge-youtube">~ YouTube Verified</span>;
      case "screenshot_verified":
        return <span className="mc-badge mc-badge-indigo">✓ Screenshot Verified</span>;
      case "api_verified":
        return <span className="mc-badge mc-badge-green">✓ API Verified</span>;
      default:
        return <span className="mc-badge mc-badge-grey">○ Self-Reported</span>;
    }
  };

  return (
    <div className="min-h-screen relative pb-16">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div
          className="absolute top-20 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #6C5CE7, transparent)" }}
        />
        <div
          className="absolute bottom-20 left-10 w-[400px] h-[400px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #00D2D3, transparent)" }}
        />
      </div>

      {/* Nav */}
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* ── AUTH VIEWS ── */}
        {(view === "login" || view === "signup" || view === "forgot_password" || view === "reset_password") && (
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">
                {view === "login"
                  ? "Login"
                  : view === "signup"
                  ? "Create Account"
                  : view === "forgot_password"
                  ? "Reset Password"
                  : "Change Password"}
              </h1>
              <p className="text-[--mc-text-secondary]">
                {view === "login"
                  ? "Access your rate cards, history, and verification badge"
                  : view === "signup"
                  ? "Sign up to track and verify your content creator rates"
                  : "Configure your credentials to secure your creator account"}
              </p>
            </div>

            {/* Toggle tabs */}
            {(view === "login" || view === "signup") && (
              <div className="flex bg-[--mc-bg-elevated] p-1 rounded-xl mb-6">
                <button
                  onClick={() => {
                    setView("login");
                    setError("");
                    setSuccessMsg("");
                    setSignupErrors({});
                  }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                    view === "login"
                      ? "bg-[--mc-primary] text-white shadow-sm font-semibold"
                      : "text-[--mc-text-secondary] hover:text-[--mc-primary] hover:bg-slate-200/50"
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    setView("signup");
                    setError("");
                    setSuccessMsg("");
                    setSignupErrors({});
                  }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                    view === "signup"
                      ? "bg-[--mc-primary] text-white shadow-sm font-semibold"
                      : "text-[--mc-text-secondary] hover:text-[--mc-primary] hover:bg-slate-200/50"
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* Error & Success Messages */}
            {error && <div className="mc-error-text mb-4 text-center">{error}</div>}
            {successMsg && (
              <div className="glass p-4 rounded-xl text-sm text-[--mc-success] mb-4 text-center">
                ✅ {successMsg}
              </div>
            )}

            {/* LOGIN FORM */}
            {view === "login" && (
              <div className="mc-card p-8 space-y-5">
                <div>
                  <label htmlFor="login-email" className="mc-label">
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    className="mc-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="login-password" className="mc-label mb-0">
                      Password
                    </label>
                    <button
                      onClick={() => {
                        setView("forgot_password");
                        setError("");
                        setSuccessMsg("");
                      }}
                      className="text-xs text-[--mc-primary] hover:text-[--mc-primary-dark] hover:underline cursor-pointer bg-transparent border-none p-0"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPasswordText ? "text" : "password"}
                      placeholder="Enter your password"
                      className="mc-input pr-16"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[--mc-text-secondary] hover:text-[--mc-primary] cursor-pointer bg-transparent border-none"
                    >
                      {showPasswordText ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="mc-btn mc-btn-primary w-full cursor-pointer"
                  >
                    {loading ? "Logging in..." : "Login →"}
                  </button>
                  <button
                    onClick={handleLoginWithMagicLink}
                    disabled={loading}
                    className="mc-btn mc-btn-secondary w-full text-xs py-2 cursor-pointer"
                  >
                    {loading ? "Requesting..." : "Or Sign In with Magic Link"}
                  </button>
                </div>
                <div className="text-center pt-1 border-t border-[--mc-border] flex flex-col gap-2">
                  <button
                    onClick={() => handleResendVerification(email)}
                    disabled={resendVerifyLoading}
                    className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer bg-transparent border-none"
                  >
                    {resendVerifyLoading ? "Resending..." : "✉️ Resend Verification Link"}
                  </button>
                  <div>
                    <span className="text-xs text-[--mc-text-secondary]">New user? </span>
                    <button
                      onClick={() => {
                        setView("signup");
                        setError("");
                        setSuccessMsg("");
                      }}
                      className="text-xs font-semibold text-[--mc-primary] hover:text-[--mc-primary-dark] hover:underline cursor-pointer bg-transparent border-none"
                    >
                      Create an account
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SIGNUP FORM */}
            {view === "signup" && (
              <div className="mc-card p-8 space-y-5">
                <div>
                  <label htmlFor="signup-name" className="mc-label">
                    Full Name <span className="text-[--mc-error]">*</span>
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    placeholder="e.g. Rohit Sharma"
                    className={`mc-input ${signupErrors.name ? "mc-input-error" : ""}`}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                  {signupErrors.name && (
                    <p className="mc-error-text mt-1">{signupErrors.name}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="signup-email" className="mc-label">
                    Email Address <span className="text-[--mc-error]">*</span>
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    className={`mc-input ${signupErrors.email ? "mc-input-error" : ""}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {signupErrors.email && (
                    <p className="mc-error-text mt-1">{signupErrors.email}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="signup-phone" className="mc-label">
                    Phone Number (Optional)
                  </label>
                  <input
                    id="signup-phone"
                    type="tel"
                    placeholder="e.g. 9999999999 (10 digits)"
                    className={`mc-input ${signupErrors.phone ? "mc-input-error" : ""}`}
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  />
                  {signupErrors.phone && (
                    <p className="mc-error-text mt-1">{signupErrors.phone}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="signup-password" className="mc-label">
                    Password <span className="text-[--mc-error]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPasswordText ? "text" : "password"}
                      placeholder="Min 6 characters"
                      className={`mc-input pr-16 ${signupErrors.password ? "mc-input-error" : ""}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[--mc-text-secondary] hover:text-[--mc-primary] cursor-pointer bg-transparent border-none"
                    >
                      {showPasswordText ? "Hide" : "Show"}
                    </button>
                  </div>
                  {signupErrors.password && (
                    <p className="mc-error-text mt-1">{signupErrors.password}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="signup-niche" className="mc-label">
                      Niche <span className="text-[--mc-error]">*</span>
                    </label>
                    <select
                      id="signup-niche"
                      className={`mc-input ${signupErrors.niche ? "mc-input-error" : ""}`}
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                    >
                      <option value="">Select Niche</option>
                      {nicheOptions.map((n) => (
                        <option key={n} value={n}>
                          {NICHE_MULTIPLIERS[n]?.label || n}
                        </option>
                      ))}
                    </select>
                    {signupErrors.niche && (
                      <p className="mc-error-text mt-1">{signupErrors.niche}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="signup-city" className="mc-label">
                      City <span className="text-[--mc-error]">*</span>
                    </label>
                    <select
                      id="signup-city"
                      className={`mc-input ${signupErrors.city ? "mc-input-error" : ""}`}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      <option value="">Select City</option>
                      {cityOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {signupErrors.city && (
                      <p className="mc-error-text mt-1">{signupErrors.city}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSignUp}
                  disabled={loading}
                  className="mc-btn mc-btn-primary w-full cursor-pointer"
                >
                  {loading ? "Registering..." : "Create Account →"}
                </button>
                <div className="text-center pt-2 border-t border-[--mc-border]">
                  <span className="text-xs text-[--mc-text-secondary]">Already have an account? </span>
                  <button
                    onClick={() => {
                      setView("login");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className="text-xs font-semibold text-[--mc-primary] hover:text-[--mc-primary-dark] hover:underline cursor-pointer bg-transparent border-none"
                  >
                    Log In
                  </button>
                </div>
              </div>
            )}

            {/* FORGOT PASSWORD FORM */}
            {view === "forgot_password" && (
              <div className="mc-card p-8 space-y-5 text-left">
                <div className="space-y-2">
                  <h3 className="font-bold text-lg text-[--mc-text-primary]">Forgot Password</h3>
                  <p className="text-xs text-[--mc-text-secondary]">
                    Enter your email address below. We will output a reset password link to your developer console log for local verification.
                  </p>
                </div>
                <div>
                  <label htmlFor="forgot-email" className="mc-label">
                    Email Address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    className="mc-input"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleSendResetPassword}
                  disabled={loading}
                  className="mc-btn mc-btn-primary w-full cursor-pointer"
                >
                  {loading ? "Requesting Reset..." : "Send Reset Link →"}
                </button>
                <div className="text-center pt-2 border-t border-[--mc-border]">
                  <button
                    onClick={() => {
                      setView("login");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className="text-xs font-semibold text-[--mc-primary] hover:text-[--mc-primary-dark] hover:underline cursor-pointer bg-transparent border-none"
                  >
                    ← Back to Login
                  </button>
                </div>
              </div>
            )}

            {/* RESET PASSWORD FORM */}
            {view === "reset_password" && (
              <div className="mc-card p-8 space-y-5 text-left">
                <div className="space-y-2">
                  <h3 className="font-bold text-lg text-[--mc-text-primary]">Configure New Password</h3>
                  <p className="text-xs text-[--mc-text-secondary]">
                    Configure password credentials for: <span className="font-semibold text-[--mc-primary]">{resetEmail}</span>
                  </p>
                </div>
                <div>
                  <label htmlFor="reset-new-pwd" className="mc-label">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-new-pwd"
                      type={showPasswordText ? "text" : "password"}
                      placeholder="Min 6 characters"
                      className="mc-input pr-16"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[--mc-text-secondary] hover:text-[--mc-primary] cursor-pointer bg-transparent border-none"
                    >
                      {showPasswordText ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="reset-confirm-pwd" className="mc-label">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-confirm-pwd"
                      type={showConfirmPasswordText ? "text" : "password"}
                      placeholder="Confirm new password"
                      className="mc-input pr-16"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPasswordText(!showConfirmPasswordText)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[--mc-text-secondary] hover:text-[--mc-primary] cursor-pointer bg-transparent border-none"
                    >
                      {showConfirmPasswordText ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleExecuteResetPassword}
                  disabled={loading}
                  className="mc-btn mc-btn-primary w-full cursor-pointer"
                >
                  {loading ? "Saving Password..." : "Update Password →"}
                </button>
                <div className="text-center pt-2 border-t border-[--mc-border]">
                  <button
                    onClick={() => {
                      setView("login");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className="text-xs font-semibold text-[--mc-primary] hover:text-[--mc-primary-dark] hover:underline cursor-pointer bg-transparent border-none"
                  >
                    ← Back to Login
                  </button>
                </div>
              </div>
            )}
          </div>
        )}



        {/* ── DASHBOARD VIEW ── */}
        {view === "dashboard" && (
          <div className="space-y-8 animate-fade-in opacity-0">
            {/* Header Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mc-card p-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#6C5CE7] to-[#00D2D3] flex items-center justify-center text-3xl font-bold">
                  {profile?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-3">
                    Welcome back, {profile?.name || "Creator"}!
                  </h1>
                  <p className="text-[--mc-text-secondary] text-sm mt-1">
                    Manage details, upload verifications, and view past rate calculations.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {profile && getVerificationBadge(profile.verification_tier)}
              </div>
            </div>

            {error && <div className="mc-error-text text-center">{error}</div>}
            {successMsg && (
              <div className="glass p-4 rounded-xl text-sm text-[--mc-success] text-center">
                ✅ {successMsg}
              </div>
            )}

            {/* Warning Banner for Pending Verification */}
            {profile?.approval_status === "pending" && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-left flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-700 font-bold">
                    <span>⚠️</span>
                    <h4 className="font-bold">Account Pending Approval</h4>
                  </div>
                  <p className="text-xs text-amber-600 leading-relaxed max-w-2xl">
                    Your creator account is pending administrator review. You can edit your profile details, but saved rate card sharing links and PDF downloads are disabled until your account is approved.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start md:self-auto">
                  {profile?.quick_review_requested || instantReviewRequested ? (
                    <div className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/10 rounded-xl py-2 px-4 text-xs font-semibold animate-pulse whitespace-nowrap">
                      🚀 Review Alert Sent!
                    </div>
                  ) : (
                    <button
                      onClick={handleRequestInstantReview}
                      disabled={loading}
                      className="mc-btn mc-btn-primary mc-btn-sm text-xs cursor-pointer bg-gradient-to-r from-amber-500 to-amber-600 border-none hover:from-amber-600 hover:to-amber-700 shadow-md text-white font-bold whitespace-nowrap"
                    >
                      {loading ? "Notifying..." : "⚡ Request Account Approval"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Profile Details Panel (Col 1) */}
              <div className="mc-card p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-[--mc-border] pb-4">
                  <h2 className="font-semibold text-lg">My Details</h2>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-sm text-[--mc-primary-light] hover:underline"
                    >
                      Edit Profile
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEditing(false)}
                      className="text-sm text-[--mc-text-muted] hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  <div className="space-y-4">
                    <ProfileRow label="Name" value={profile?.name || "—"} />
                    <ProfileRow label="Email" value={profile?.email || "—"} />
                    <ProfileRow label="Phone" value={profile?.phone || "—"} />
                     <ProfileRow
                      label="Niche"
                      value={profile?.niche ? (NICHE_MULTIPLIERS[profile.niche]?.label || profile.niche) : "—"}
                    />
                    <ProfileRow label="City" value={profile?.city || "—"} />
                    <ProfileRow
                      label="Location Tier"
                      value={profile?.city_tier?.replace("_", " ").toUpperCase() || "—"}
                    />
                    <ProfileRow
                      label="Engagement Rate"
                      value={profile?.engagement_rate ? `${profile.engagement_rate}%` : "Pending Review"}
                    />

                    {/* Social Handles & Stats */}
                    {(profile?.instagram_handle || profile?.followers_instagram !== null) && (
                      <div className="border-t border-[--mc-border] pt-3 mt-2 text-left space-y-1">
                        <p className="text-xs font-semibold text-[--mc-text-secondary]">📸 Instagram</p>
                        <ProfileRow label="Handle" value={profile?.instagram_handle ? `@${profile.instagram_handle.replace(/^@/, "")}` : "Not set"} />
                        {profile?.followers_instagram !== null && profile?.followers_instagram !== undefined && (
                          <ProfileRow label="Followers" value={profile.followers_instagram.toLocaleString("en-IN")} />
                        )}
                      </div>
                    )}
                    {(profile?.youtube_handle || profile?.followers_youtube !== null) && (
                      <div className="border-t border-[--mc-border] pt-3 mt-2 text-left space-y-1">
                        <p className="text-xs font-semibold text-[--mc-text-secondary]">🎬 YouTube</p>
                        <ProfileRow label="Channel" value={profile?.youtube_handle ? `@${profile.youtube_handle.replace(/^@/, "")}` : "Not set"} />
                        {profile?.followers_youtube !== null && profile?.followers_youtube !== undefined && (
                          <ProfileRow label="Subscribers" value={profile.followers_youtube.toLocaleString("en-IN")} />
                        )}
                      </div>
                    )}
                    {(profile?.facebook_handle || profile?.followers_facebook !== null) && (
                      <div className="border-t border-[--mc-border] pt-3 mt-2 text-left space-y-1">
                        <p className="text-xs font-semibold text-[--mc-text-secondary]">📘 Facebook</p>
                        <ProfileRow label="Page" value={profile?.facebook_handle || "Not set"} />
                        {profile?.followers_facebook !== null && profile?.followers_facebook !== undefined && (
                          <ProfileRow label="Followers" value={profile.followers_facebook.toLocaleString("en-IN")} />
                        )}
                      </div>
                    )}

                    {profile?.screenshot_url && (
                      <div className="border-t border-[--mc-border] pt-3 mt-2 space-y-2 text-left">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[--mc-text-secondary]">Screenshot Review:</span>
                          {profile.screenshot_status === "approved" ? (
                            <span className="text-[--mc-success] font-bold">✓ Approved</span>
                          ) : profile.screenshot_status === "rejected" ? (
                            <span className="text-[--mc-error] font-bold">❌ Rejected</span>
                          ) : (
                            <span className="text-[--mc-warning] font-bold">⏳ Pending Review</span>
                          )}
                        </div>

                        {/* Profile verification status */}
                        <div className="flex justify-between items-center text-xs pt-1 border-t border-[--mc-border]/10">
                          <span className="text-[--mc-text-secondary]">Badge Status:</span>
                          {profile.verification_tier !== "self_reported" ? (
                            <span className="text-[--mc-success] font-bold">✓ Verified</span>
                          ) : profile.profile_verification_requested ? (
                            <span className="text-amber-500 font-bold">⏳ Pending Admin</span>
                          ) : (
                            <span className="text-[--mc-text-muted]">○ Self-Reported</span>
                          )}
                        </div>

                        {profile.screenshot_status === "pending" && !profile.quick_review_requested && (
                          <button
                            onClick={handleRequestQuickReview}
                            disabled={loading}
                            className="mc-btn mc-btn-secondary w-full text-[10px] py-1 bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer"
                          >
                            ⚡ Request Quick Review
                          </button>
                        )}
                        {profile.screenshot_status === "pending" && profile.quick_review_requested && (
                          <p className="text-[10px] text-center text-red-400 font-semibold animate-pulse">
                            ⚡ Quick review requested!
                          </p>
                        )}

                        {/* Profile verification request button */}
                        {profile.verification_tier === "self_reported" && !profile.profile_verification_requested && (
                          <button
                            onClick={handleRequestProfileVerification}
                            disabled={profileVerifyLoading}
                            className="mc-btn mc-btn-primary w-full text-[10px] py-1 cursor-pointer bg-gradient-to-r from-indigo-500 to-violet-600 border-none text-white font-bold"
                          >
                            {profileVerifyLoading ? "Requesting Badge..." : "⚡ Request Profile Verification"}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="mc-btn mc-btn-secondary w-full text-xs py-2 cursor-pointer"
                      >
                        {profile?.screenshot_url ? "📷 Upload New Screenshot" : "📷 Upload Verification Screenshot"}
                      </button>
                    </div>

                    {/* Security & Password reset section */}
                    <div className="border-t border-[--mc-border] pt-4 mt-2 text-left space-y-4">
                      <p className="text-xs font-semibold text-[--mc-text-secondary]">🔒 Security</p>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[--mc-text-muted] uppercase tracking-wider block">
                          Change Account Password
                        </label>
                        <div className="relative">
                          <input
                            type={showDashboardPassword ? "text" : "password"}
                            placeholder="Enter new password"
                            className="mc-input text-xs py-2 pr-12"
                            value={dashboardNewPassword}
                            onChange={(e) => setDashboardNewPassword(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowDashboardPassword(!showDashboardPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[--mc-text-secondary] hover:text-[--mc-primary] cursor-pointer bg-transparent border-none"
                          >
                            {showDashboardPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                        {changePasswordError && (
                          <p className="text-[10px] text-[--mc-error] font-semibold">{changePasswordError}</p>
                        )}
                        {changePasswordSuccess && (
                          <p className="text-[10px] text-[--mc-success] font-semibold">✓ {changePasswordSuccess}</p>
                        )}
                        <button
                          onClick={handleDashboardChangePassword}
                          disabled={changePasswordLoading}
                          className="mc-btn mc-btn-secondary w-full text-[10px] py-1 cursor-pointer bg-[--mc-primary]/5 hover:bg-[--mc-primary]/10 text-[--mc-primary] border-[--mc-primary]/10"
                        >
                          {changePasswordLoading ? "Updating..." : "Update Password"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="mc-label">Full Name</label>
                      <input
                        type="text"
                        className="mc-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mc-label">Phone Number</label>
                      <input
                        type="tel"
                        className="mc-input"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                      />
                    </div>
                     <div>
                      <label className="mc-label">Niche</label>
                      <select
                        className="mc-input"
                        value={editNiche}
                        onChange={(e) => setEditNiche(e.target.value)}
                      >
                        {nicheOptions.map((n) => (
                          <option key={n} value={n}>
                            {NICHE_MULTIPLIERS[n]?.label || n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mc-label">City</label>
                      <select
                        className="mc-input"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                      >
                        {cityOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="border-t border-[--mc-border] pt-4 mt-2 space-y-4 text-left">
                      <p className="text-xs font-bold text-[--mc-text-secondary] uppercase tracking-wider">📸 Verify Social Profiles</p>

                      {/* Status alerts */}
                      {(verifyError || verifySuccess || verifyingPlatform) && (
                        <div className="text-center p-3.5 rounded-lg bg-[--mc-bg-secondary] border border-[--mc-border] text-xs">
                          {verifyingPlatform && (
                            <p className="text-indigo-400 font-semibold animate-pulse">
                              ⏳ Verifying {verifyingPlatform} handle... (Takes 15-20s)
                            </p>
                          )}
                          {verifySuccess && <p className="text-[--mc-success] font-semibold">✓ {verifySuccess}</p>}
                          {verifyError && <p className="text-[--mc-warning] font-semibold">⚠ {verifyError}</p>}
                        </div>
                      )}

                      <div className="space-y-4">
                        {/* Instagram Block */}
                        <div className="bg-[--mc-bg-secondary]/50 p-4 rounded-xl border border-[--mc-border]/50 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-[--mc-text-primary] flex items-center gap-1.5">
                              📸 Instagram Profile
                              {profile?.instagram_handle && profile?.verification_tier === "api_verified" && (
                                <span className="text-[--mc-success] font-semibold">✓ Verified</span>
                              )}
                            </span>
                            <button
                              type="button"
                              disabled={verifyingPlatform !== null}
                              onClick={() => handleVerifyHandle("instagram")}
                              className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-md font-bold hover:bg-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {verifyingPlatform === "instagram" ? "Verifying..." : "⚡ Verify"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-[--mc-text-muted] font-bold">Handle</label>
                              <input
                                type="text"
                                placeholder="e.g. handle"
                                className="mc-input mt-1"
                                value={editInstagram}
                                onChange={(e) => setEditInstagram(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-[--mc-text-muted] font-bold">Followers</label>
                              <input
                                type="number"
                                placeholder="e.g. 10000"
                                className="mc-input mt-1"
                                value={editFollowersInstagram}
                                onChange={(e) => setEditFollowersInstagram(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* YouTube Block */}
                        <div className="bg-[--mc-bg-secondary]/50 p-4 rounded-xl border border-[--mc-border]/50 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-[--mc-text-primary] flex items-center gap-1.5">
                              🎬 YouTube Channel
                              {profile?.youtube_handle && profile?.verification_tier === "api_verified" && (
                                <span className="text-[--mc-success] font-semibold">✓ Verified</span>
                              )}
                            </span>
                            <button
                              type="button"
                              disabled={verifyingPlatform !== null}
                              onClick={() => handleVerifyHandle("youtube")}
                              className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-md font-bold hover:bg-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {verifyingPlatform === "youtube" ? "Verifying..." : "⚡ Verify"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-[--mc-text-muted] font-bold">Channel Name</label>
                              <input
                                type="text"
                                placeholder="e.g. channel"
                                className="mc-input mt-1"
                                value={editYoutube}
                                onChange={(e) => setEditYoutube(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-[--mc-text-muted] font-bold">Subscribers</label>
                              <input
                                type="number"
                                placeholder="e.g. 50000"
                                className="mc-input mt-1"
                                value={editFollowersYoutube}
                                onChange={(e) => setEditFollowersYoutube(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Facebook Block */}
                        <div className="bg-[--mc-bg-secondary]/50 p-4 rounded-xl border border-[--mc-border]/50 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-[--mc-text-primary] flex items-center gap-1.5">
                              📘 Facebook Page
                              {profile?.facebook_handle && profile?.verification_tier === "api_verified" && (
                                <span className="text-[--mc-success] font-semibold">✓ Verified</span>
                              )}
                            </span>
                            <button
                              type="button"
                              disabled={verifyingPlatform !== null}
                              onClick={() => handleVerifyHandle("facebook")}
                              className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-md font-bold hover:bg-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {verifyingPlatform === "facebook" ? "Verifying..." : "⚡ Verify"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-[--mc-text-muted] font-bold">Page Handle</label>
                              <input
                                type="text"
                                placeholder="e.g. page"
                                className="mc-input mt-1"
                                value={editFacebook}
                                onChange={(e) => setEditFacebook(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-[--mc-text-muted] font-bold">Followers</label>
                              <input
                                type="number"
                                placeholder="e.g. 5000"
                                className="mc-input mt-1"
                                value={editFollowersFacebook}
                                onChange={(e) => setEditFollowersFacebook(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleUpdateProfile}
                      disabled={loading}
                      className="mc-btn mc-btn-primary w-full mt-2"
                    >
                      {loading ? "Saving..." : "Save Details"}
                    </button>
                  </div>
                )}
              </div>

              {/* History & Saved Rates Panel (Col 2 & 3) */}
              <div className="lg:col-span-2 space-y-8">
                {/* Active Saved Rates Card */}
                <div className="mc-card p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[--mc-border] pb-4">
                    <div>
                      <h2 className="font-semibold text-lg text-left">My Saved Rate Cards</h2>
                      <p className="text-xs text-[--mc-text-secondary] mt-1 text-left">
                        These are your saved deliverable prices verified on your profile.
                      </p>
                    </div>
                    {profile && (
                      <div className="flex items-center gap-2 self-start sm:self-auto relative">
                        <button
                          onClick={handleCopyShareLink}
                          className="mc-btn mc-btn-primary mc-btn-sm text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                        >
                          🔗 Copy Share Link
                        </button>
                        {shareCopied && (
                          <span className="absolute -top-9 right-0 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg animate-fade-in whitespace-nowrap">
                            Copied to clipboard! 📋
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {savedCards.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-[--mc-text-secondary] text-sm">
                        No active rate cards saved. Run a calculation and download the PDF to save your pricing.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(
                        savedCards.reduce((acc: any, card: any) => {
                          if (!acc[card.platform]) {
                            acc[card.platform] = [];
                          }
                          // Filter out any duplicate rows of the same deliverable type (safe fallback for older data)
                          if (!acc[card.platform].some((item: any) => item.deliverable_type === card.deliverable_type)) {
                            acc[card.platform].push(card);
                          }
                          return acc;
                        }, {})
                      ).map(([platform, cards]: [string, any]) => (
                        <div key={platform} className="glass p-4 rounded-xl space-y-3 text-left">
                          <h3 className="font-semibold text-sm flex items-center gap-2 capitalize">
                            {platform === "instagram" ? "📸" : platform === "youtube" ? "🎬" : "📘"} {platform}
                          </h3>
                          <div className="space-y-2">
                            {cards.map((card: any) => (
                              <div key={card.id} className="flex justify-between items-center text-xs py-1 border-b border-[--mc-border] last:border-0">
                                <span className="text-[--mc-text-secondary] capitalize">
                                  {card.deliverable_type.replace(/_/g, " ").replace(platform, "").trim()}
                                </span>
                                <span className="font-bold text-[--mc-success]">
                                  ₹{parseFloat(card.calculated_rate_median).toLocaleString("en-IN")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 📊 Engagement Performance Center */}
                <div className="mc-card p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[--mc-border] pb-4">
                    <div>
                      <h2 className="font-semibold text-lg text-left flex items-center gap-2">
                        📊 Engagement Performance Center
                        {profile?.verification_tier === "api_verified" && (
                          <span className="text-xs bg-[--mc-success]/10 text-[--mc-success] px-2 py-0.5 rounded-full border border-[--mc-success]/20 font-bold">
                            ✓ Verified
                          </span>
                        )}
                      </h2>
                      <p className="text-xs text-[--mc-text-secondary] mt-1 text-left">
                        Real-time analytics summary fetched directly from your verified social channels.
                      </p>
                    </div>
                  </div>

                  {profile?.verification_tier !== "api_verified" ? (
                    <div className="text-center py-8 px-4 bg-[--mc-bg-secondary]/30 rounded-xl border border-dashed border-[--mc-border] space-y-3">
                      <span className="text-3xl block">🔒</span>
                      <p className="text-sm font-semibold text-[--mc-text-primary]">Unlock Live Analytics & Engagement Tracking</p>
                      <p className="text-xs text-[--mc-text-secondary] max-w-sm mx-auto text-center">
                        Verify your social media handles inside the profile editor to auto-fetch your feed metrics and show a verified badge on your rate cards.
                      </p>
                    </div>
                  ) : (() => {
                    let posts: any[] = [];
                    if (typeof window !== "undefined") {
                      const cached = sessionStorage.getItem("mc_fetched_posts");
                      if (cached) {
                        try {
                          posts = JSON.parse(cached);
                        } catch {}
                      }
                    }

                    const erVal = profile.engagement_rate ? parseFloat(profile.engagement_rate) : 0.0;
                    
                    const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
                    const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);
                    const count = posts.length || 1;
                    const avgLikes = Math.round(totalLikes / count);
                    const avgComments = Math.round(totalComments / count);
                    const avgShares = Math.round(avgLikes * 0.04);
                    
                    const postsWithViews = posts.filter(p => p.views !== null);
                    const avgViews = postsWithViews.length > 0
                      ? Math.round(postsWithViews.reduce((sum, p) => sum + (p.views || 0), 0) / postsWithViews.length)
                      : 0;

                    return (
                      <div className="space-y-6">
                        {/* Summary Metrics Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full text-center">
                          <div className="bg-[--mc-bg-secondary] p-3 rounded-lg border border-[--mc-border]/60">
                            <p className="text-[9px] text-[--mc-text-secondary] uppercase font-bold tracking-wider">Engagement Rate</p>
                            <p className="text-base font-extrabold text-[--mc-success] mt-1">{erVal > 0 ? `${erVal}%` : "—"}</p>
                          </div>
                          <div className="bg-[--mc-bg-secondary] p-3 rounded-lg border border-[--mc-border]/60">
                            <p className="text-[9px] text-[--mc-text-secondary] uppercase font-bold tracking-wider">Avg. Likes</p>
                            <p className="text-base font-extrabold text-indigo-400 mt-1">{avgLikes > 0 ? avgLikes.toLocaleString() : "—"}</p>
                          </div>
                          <div className="bg-[--mc-bg-secondary] p-3 rounded-lg border border-[--mc-border]/60">
                            <p className="text-[9px] text-[--mc-text-secondary] uppercase font-bold tracking-wider">Avg. Comments</p>
                            <p className="text-base font-extrabold text-teal-400 mt-1">{avgComments > 0 ? avgComments.toLocaleString() : "—"}</p>
                          </div>
                          <div className="bg-[--mc-bg-secondary] p-3 rounded-lg border border-[--mc-border]/60">
                            <p className="text-[9px] text-[--mc-text-secondary] uppercase font-bold tracking-wider">Avg. Shares</p>
                            <p className="text-base font-extrabold text-pink-400 mt-1">{avgLikes > 0 ? avgShares.toLocaleString() : "—"}</p>
                          </div>
                          <div className="bg-[--mc-bg-secondary] p-3 rounded-lg border border-[--mc-border]/60">
                            <p className="text-[9px] text-[--mc-text-secondary] uppercase font-bold tracking-wider">Avg. Views</p>
                            <p className="text-base font-extrabold text-amber-400 mt-1">{avgViews > 0 ? avgViews.toLocaleString() : "—"}</p>
                          </div>
                        </div>

                        {posts.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-[--mc-text-secondary] text-left">Recent Feed Contents (Last 10 items):</p>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                              {posts.map((post, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-[--mc-bg-secondary]/50 border border-[--mc-border]/30">
                                  {post.imageUrl && (
                                    <img
                                      src={post.imageUrl}
                                      alt=""
                                      className="w-8 h-8 rounded object-cover flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0 text-left">
                                    <p className="text-xs font-semibold text-[--mc-text-primary] truncate">{post.title}</p>
                                    <p className="text-[9px] text-[--mc-text-muted]">{post.date}</p>
                                  </div>
                                  <div className="flex gap-3 text-xs font-semibold flex-shrink-0">
                                    <span className="text-indigo-400">❤️ {post.likes.toLocaleString()}</span>
                                    <span className="text-teal-400">💬 {post.comments.toLocaleString()}</span>
                                    {post.views !== null && <span className="text-amber-400">👁️ {post.views.toLocaleString()}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Calculations History Card */}
                <div className="mc-card p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-[--mc-border] pb-4">
                    <h2 className="font-semibold text-lg">Rate Card Calculation History</h2>
                    <a href="/calculate" className="mc-btn mc-btn-primary mc-btn-sm cursor-pointer">
                      + Generate New
                    </a>
                  </div>

                  {history.length === 0 ? (
                    <div className="text-center py-12">
                      <span className="text-4xl block mb-3">📊</span>
                      <p className="text-[--mc-text-secondary] text-sm mb-4">
                        You haven&apos;t saved any rate card calculations yet.
                      </p>
                      <a href="/calculate" className="mc-btn mc-btn-secondary inline-block">
                        Calculate Your First Rate
                      </a>
                    </div>
                ) : (
                  <div className="space-y-4">
                    {history.map((calc) => (
                      <div
                        key={calc.id}
                        className="glass p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[--mc-border-hover] border border-transparent transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[--mc-text-primary]">{calc.creator_name}</span>
                            <span className="text-xs text-[--mc-text-muted]">•</span>
                            <span className="text-xs text-[--mc-text-secondary]">{NICHE_MULTIPLIERS[calc.niche]?.label || calc.niche}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[--mc-text-muted] flex-wrap">
                            <span>
                              Calculated on: {new Date(calc.created_at).toLocaleDateString("en-IN")}
                            </span>
                            <span>•</span>
                            <div className="flex gap-2">
                              {calc.platforms.map((p: string) => (
                                <span
                                  key={p}
                                  className="px-1.5 py-0.5 rounded bg-[--mc-bg-elevated] text-[10px] uppercase font-bold"
                                  style={{
                                    color:
                                      p === "instagram"
                                        ? "#E1306C"
                                        : p === "youtube"
                                        ? "#FF0000"
                                        : "#1877F2",
                                  }}
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start md:self-center">
                          <button
                            onClick={() => handleViewPastCalculation(calc)}
                            className="mc-btn mc-btn-secondary mc-btn-sm whitespace-nowrap cursor-pointer"
                          >
                            View Rate Card →
                          </button>
                          <button
                            onClick={() => handleDeleteHistory(calc.id)}
                            disabled={loading}
                            className="mc-btn mc-btn-secondary mc-btn-sm text-red-400 border-red-500/20 hover:bg-red-500/10 cursor-pointer p-2 flex items-center justify-center"
                            title="Delete from history"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </main>

      {/* Screenshot Upload Modal */}
      {showUploadModal && profile && (
        <ScreenshotUploadModal
          profileId={profile.id}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            if (userId) loadProfileAndHistory(userId);
          }}
        />
      )}
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
