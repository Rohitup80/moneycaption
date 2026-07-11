"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import { cityOptions, cityTierMapping, nicheOptions, NICHE_MULTIPLIERS } from "@/lib/rate-config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CreatorProfile {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  instagram_handle: string | null;
  youtube_handle: string | null;
  facebook_handle: string | null;
  followers_instagram: number | null;
  followers_youtube: number | null;
  followers_facebook: number | null;
  niche: string;
  city_tier: string;
  engagement_rate: number | null;
  verification_tier: string;
  screenshot_url: string | null;
  screenshot_status: string | null;
  quick_review_requested: boolean;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  downloads_count?: number;
  shares_count?: number;
  updates_count?: number;
  deletes_count?: number;
  profile_verification_requested?: boolean;
}

interface ReviewItem {
  id: string;
  creator_id: string;
  status: string;
  created_at: string;
  creator_profiles: CreatorProfile | null;
}

export default function AdminReviewPage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [profiles, setProfiles] = useState<CreatorProfile[]>([]);
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Tabs structure: new, approved, rejected, screenshot, all, stats
  const [activeTab, setActiveTab] = useState<"new" | "approved" | "rejected" | "screenshot" | "all" | "stats">("new");

  // Modals & form views state
  const [editingProfile, setEditingProfile] = useState<CreatorProfile | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states - Add Creator
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNiche, setNewNiche] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newInstagram, setNewInstagram] = useState("");
  const [newYoutube, setNewYoutube] = useState("");
  const [newFacebook, setNewFacebook] = useState("");
  const [newFollowersInstagram, setNewFollowersInstagram] = useState("");
  const [newFollowersYoutube, setNewFollowersYoutube] = useState("");
  const [newFollowersFacebook, setNewFollowersFacebook] = useState("");

  // Form states - Edit Creator
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNiche, setEditNiche] = useState("");
  // Form states - Edit Creator details
  const [editCity, setEditCity] = useState("");
  const [editInstagram, setEditInstagram] = useState("");
  const [editYoutube, setEditYoutube] = useState("");
  const [editFacebook, setEditFacebook] = useState("");
  const [editFollowersInstagram, setEditFollowersInstagram] = useState("");
  const [editFollowersYoutube, setEditFollowersYoutube] = useState("");
  const [editFollowersFacebook, setEditFollowersFacebook] = useState("");
  const [editEngagementRate, setEditEngagementRate] = useState("");

  // For screenshot review manual inputs
  const [engagementInputs, setEngagementInputs] = useState<Record<string, string>>({});
  const [avgViewsInputs, setAvgViewsInputs] = useState<Record<string, string>>({});

  // Selected creator detail modal states
  const [selectedCreator, setSelectedCreator] = useState<CreatorProfile | null>(null);
  const [selectedCreatorHistory, setSelectedCreatorHistory] = useState<any[]>([]);
  const [selectedCreatorCards, setSelectedCreatorCards] = useState<any[]>([]);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pdfGenerator, setPdfGenerator] = useState<any>(null);

  // Statistics overall counts
  const [totalCalculationsCount, setTotalCalculationsCount] = useState(0);
  const [totalRateCardsCount, setTotalRateCardsCount] = useState(0);

  useEffect(() => {
    import("@/lib/pdf-generator").then((mod) => {
      setPdfGenerator(mod);
    });
  }, []);

  const ADMIN_PASSWORD = "moneycaption-admin-2024";

  function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthed(true);
      loadData();
    } else {
      alert("Invalid password");
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      // 1. Fetch all creator profiles
      const { data: profileList, error: pErr } = await supabase
        .from("creator_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (pErr) throw pErr;
      setProfiles(profileList || []);

      // 2. Fetch pending screenshot review queue items
      const { data: queueList, error: qErr } = await supabase
        .from("admin_review_queue")
        .select(`
          id,
          creator_id,
          status,
          created_at,
          creator_profiles (
            id,
            name,
            niche,
            phone,
            instagram_handle,
            youtube_handle,
            facebook_handle,
            followers_instagram,
            followers_youtube,
            followers_facebook,
            engagement_rate,
            screenshot_url,
            screenshot_status,
            quick_review_requested,
            approval_status,
            created_at
          )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (qErr) throw qErr;

      // Type-cast nested profile result
      const formattedQueue: ReviewItem[] = (queueList || []).map((item: any) => ({
        id: item.id,
        creator_id: item.creator_id,
        status: item.status,
        created_at: item.created_at,
        creator_profiles: item.creator_profiles as CreatorProfile | null,
      }));

      setQueue(formattedQueue);

      // 3. Fetch calculation history counts and rate cards counts for stats panel
      const { count: calcHistoryCount } = await supabase
        .from("rate_calculations")
        .select("*", { count: "exact", head: true });
      const { count: rateCardsCount } = await supabase
        .from("rate_cards")
        .select("*", { count: "exact", head: true });

      setTotalCalculationsCount(calcHistoryCount || 0);
      setTotalRateCardsCount(rateCardsCount || 0);
    } catch (err) {
      console.error("Failed to load admin dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Update account approval status (Approve, Reject/Block, Reset to New)
  async function handleUpdateApprovalStatus(creatorId: string, status: "approved" | "rejected" | "pending") {
    try {
      const { error } = await supabase
        .from("creator_profiles")
        .update({
          approval_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", creatorId);

      if (error) throw error;
      alert(`Creator account successfully ${status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Moved to New"}`);
      loadData();
    } catch (err) {
      console.error("Failed to update creator status:", err);
      alert("Failed to update status. Check console.");
    }
  }

  // Delete creator profile row
  async function handleDeleteCreator(creatorId: string) {
    if (!confirm("Are you sure you want to delete this creator profile? This is permanent and clears calculation logs!")) return;
    try {
      const { error } = await supabase
        .from("creator_profiles")
        .delete()
        .eq("id", creatorId);

      if (error) throw error;
      alert("Creator profile deleted successfully!");
      loadData();
    } catch (err) {
      console.error("Failed to delete profile:", err);
      alert("Failed to delete. Check console.");
    }
  }

  // ── Open Creator Details Modal & Fetch Logs ──
  async function handleOpenDetails(creator: CreatorProfile) {
    setSelectedCreator(creator);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      // Load saved active rate card deliverables
      const { data: cards, error: cardsErr } = await supabase
        .from("rate_cards")
        .select("*")
        .eq("creator_id", creator.id);
      if (cardsErr) throw cardsErr;
      setSelectedCreatorCards(cards || []);

      // Load calculation history matching user_id
      if (creator.user_id) {
        const { data: hist, error: histErr } = await supabase
          .from("rate_calculations")
          .select("*")
          .eq("user_id", creator.user_id)
          .order("created_at", { ascending: false });
        if (histErr) throw histErr;
        setSelectedCreatorHistory(hist || []);
      } else {
        setSelectedCreatorHistory([]);
      }
    } catch (err) {
      console.error("Failed to load creator inspection logs:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  // ── Trigger Saved Rate Card PDF Generation ──
  const handleDownloadSavedCardPdf = (creator: CreatorProfile, cards: any[]) => {
    if (!pdfGenerator) {
      alert("PDF generator is loading. Please try again in a moment.");
      return;
    }
    if (cards.length === 0) {
      alert("No active deliverables cards saved for this creator yet.");
      return;
    }

    // Convert flat database rows into structured results input
    const grouped: Record<string, any> = {};
    cards.forEach((c) => {
      if (!grouped[c.platform]) {
        grouped[c.platform] = { platform: c.platform, deliverables: [] };
      }
      grouped[c.platform].deliverables.push({
        id: c.deliverable_type,
        name: c.deliverable_type.replace(/_/g, " ").replace(c.platform, "").trim(),
        rates: {
          median: parseFloat(c.calculated_rate_median),
          min: parseFloat(c.calculated_rate_min || c.calculated_rate_median),
          max: parseFloat(c.calculated_rate_max || c.calculated_rate_median),
        },
        selectedRate: parseFloat(c.calculated_rate_median),
        selectionType: "marketStandard",
      });
    });

    pdfGenerator.generateRateCardPdf({
      creatorName: creator.name,
      niche: creator.niche,
      cityTier: creator.city_tier,
      verificationTier: creator.verification_tier,
      results: Object.values(grouped),
      calculatedAt: new Date().toISOString(),
      instagramHandle: creator.instagram_handle,
      youtubeHandle: creator.youtube_handle,
      facebookHandle: creator.facebook_handle,
      followingInstagram: creator.followers_instagram,
      followingYoutube: creator.followers_youtube,
      followingFacebook: creator.followers_facebook,
    });
  };

  // ── Trigger Historical Rate Calculation PDF Generation ──
  const handleDownloadHistoryPdf = (calc: any) => {
    if (!pdfGenerator) {
      alert("PDF generator is loading. Please try again in a moment.");
      return;
    }

    pdfGenerator.generateRateCardPdf({
      creatorName: calc.creator_name,
      niche: calc.niche,
      cityTier: calc.city_tier,
      verificationTier: calc.verification_tier,
      results: calc.results_json,
      calculatedAt: calc.created_at,
      instagramHandle: calc.instagram_handle || "",
      youtubeHandle: calc.youtube_handle || "",
      facebookHandle: calc.facebook_handle || "",
      followingInstagram: calc.followers_instagram,
      followingYoutube: calc.followers_youtube,
      followingFacebook: calc.followers_facebook,
      profilePicUrl: calc.profile_pic_url || undefined,
    });
  };

  // ── Toggle Profile Verification Badge Status ──
  async function handleUpdateVerificationTier(creatorId: string, tier: string) {
    try {
      const { error } = await supabase
        .from("creator_profiles")
        .update({
          verification_tier: tier,
          profile_verification_requested: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", creatorId);

      if (error) throw error;
      alert(`Creator verification tier successfully updated to: ${tier.replace(/_/g, " ").toUpperCase()}`);
      
      // Update local inspection view and list
      setSelectedCreator((prev: any) =>
        prev ? { ...prev, verification_tier: tier, profile_verification_requested: false } : null
      );
      loadData();
    } catch (err) {
      console.error("Failed to update creator verification badge:", err);
      alert("Failed to update verification badge. Check console.");
    }
  }

  // Edit Creator Submit
  async function handleSaveEditCreator(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProfile) return;
    if (!editName || !editNiche || !editCity) {
      alert("Name, Niche, and City are required.");
      return;
    }

    try {
      const cityTier = cityTierMapping[editCity] || "tier_3";
      const { error } = await supabase
        .from("creator_profiles")
        .update({
          name: editName,
          email: editEmail || null,
          phone: editPhone || null,
          niche: editNiche,
          city_tier: cityTier,
          instagram_handle: editInstagram || null,
          youtube_handle: editYoutube || null,
          facebook_handle: editFacebook || null,
          followers_instagram: editFollowersInstagram ? parseInt(editFollowersInstagram, 10) : null,
          followers_youtube: editFollowersYoutube ? parseInt(editFollowersYoutube, 10) : null,
          followers_facebook: editFollowersFacebook ? parseInt(editFollowersFacebook, 10) : null,
          engagement_rate: editEngagementRate ? parseFloat(editEngagementRate) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingProfile.id);

      if (error) throw error;
      alert("Creator updated successfully!");
      setEditingProfile(null);
      loadData();
    } catch (err) {
      console.error("Failed to edit profile:", err);
      alert("Failed to save profile changes.");
    }
  }

  // Add Creator Submit
  async function handleAddCreator(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newNiche || !newCity) {
      alert("Name, Niche, and City are required.");
      return;
    }

    try {
      const cityTier = cityTierMapping[newCity] || "tier_3";
      const { error } = await supabase
        .from("creator_profiles")
        .insert({
          name: newName,
          email: newEmail || null,
          phone: newPhone || null,
          niche: newNiche,
          city_tier: cityTier,
          instagram_handle: newInstagram || null,
          youtube_handle: newYoutube || null,
          facebook_handle: newFacebook || null,
          followers_instagram: newFollowersInstagram ? parseInt(newFollowersInstagram, 10) : null,
          followers_youtube: newFollowersYoutube ? parseInt(newFollowersYoutube, 10) : null,
          followers_facebook: newFollowersFacebook ? parseInt(newFollowersFacebook, 10) : null,
          approval_status: "approved", // Direct approved status
          verification_tier: "self_reported",
          engagement_source: "self_reported",
        });

      if (error) throw error;
      alert("Creator profile added successfully!");
      setShowAddForm(false);
      // Reset inputs
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewNiche("");
      setNewCity("");
      setNewInstagram("");
      setNewYoutube("");
      setNewFacebook("");
      setNewFollowersInstagram("");
      setNewFollowersYoutube("");
      setNewFollowersFacebook("");
      loadData();
    } catch (err) {
      console.error("Failed to add profile:", err);
      alert("Failed to insert profile row.");
    }
  }

  // Manual Engagement reviews (same queue submit)
  async function handleEngagementReviewSubmit(queueId: string, creatorId: string) {
    const rate = parseFloat(engagementInputs[queueId] || "");
    if (isNaN(rate) || rate <= 0 || rate > 100) {
      alert("Please enter a valid engagement rate (0.1–100)");
      return;
    }

    const avgViews = parseInt(avgViewsInputs[queueId] || "");

    try {
      // Update creator profile values
      await supabase
        .from("creator_profiles")
        .update({
          engagement_rate: rate,
          avg_views_instagram: isNaN(avgViews) ? null : avgViews,
          engagement_source: "manual_calculated",
          engagement_calculated_by: "admin",
          updated_at: new Date().toISOString(),
        })
        .eq("id", creatorId);

      // Close review queue
      await supabase
        .from("admin_review_queue")
        .update({
          status: "reviewed",
          reviewed_engagement_rate: rate,
          reviewed_by: "admin",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", queueId);

      alert("Review submitted successfully!");
      loadData();
    } catch (err) {
      console.error("Submit engagement review failed:", err);
      alert("Failed to submit review.");
    }
  }

  // Screenshot review actions
  async function handleApproveScreenshot(queueId: string, creatorId: string) {
    try {
      await supabase
        .from("creator_profiles")
        .update({
          verification_tier: "screenshot_verified",
          screenshot_status: "approved",
          quick_review_requested: false,
          engagement_source: "screenshot_verified",
          updated_at: new Date().toISOString(),
        })
        .eq("id", creatorId);

      await supabase
        .from("admin_review_queue")
        .update({
          status: "reviewed",
          reviewed_by: "admin",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", queueId);

      alert("Screenshot approved successfully!");
      loadData();
    } catch (err) {
      console.error("Approve screenshot failed:", err);
      alert("Failed to approve screenshot.");
    }
  }

  async function handleRejectScreenshot(queueId: string, creatorId: string) {
    if (!confirm("Are you sure you want to reject this screenshot?")) return;
    try {
      await supabase
        .from("creator_profiles")
        .update({
          screenshot_status: "rejected",
          quick_review_requested: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", creatorId);

      await supabase
        .from("admin_review_queue")
        .update({
          status: "reviewed",
          reviewed_by: "admin",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", queueId);

      alert("Screenshot rejected.");
      loadData();
    } catch (err) {
      console.error("Reject screenshot failed:", err);
      alert("Failed to reject screenshot.");
    }
  }

  function handleOpenEditModal(profile: CreatorProfile) {
    setEditingProfile(profile);
    setEditName(profile.name || "");
    setEditEmail(profile.email || "");
    setEditPhone(profile.phone || "");
    setEditNiche(profile.niche || "");

    // Find city option matching tier
    const matchedCity = Object.entries(cityTierMapping).find(
      ([, tier]) => tier === profile.city_tier
    );
    setEditCity(matchedCity ? matchedCity[0] : "");

    setEditInstagram(profile.instagram_handle || "");
    setEditYoutube(profile.youtube_handle || "");
    setEditFacebook(profile.facebook_handle || "");
    setEditFollowersInstagram(profile.followers_instagram?.toString() || "");
    setEditFollowersYoutube(profile.followers_youtube?.toString() || "");
    setEditFollowersFacebook(profile.followers_facebook?.toString() || "");
    setEditEngagementRate(profile.engagement_rate?.toString() || "");
  }

  useEffect(() => {
    if (isAuthed) loadData();
  }, [isAuthed]);

  // Tab counters
  const newCreators = profiles.filter((p) => p.approval_status === "pending");
  const approvedCreators = profiles.filter((p) => p.approval_status === "approved");
  const rejectedCreators = profiles.filter((p) => p.approval_status === "rejected");
  const quickReviewCount = queue.filter((item) => item.creator_profiles?.quick_review_requested).length;

  // Tab filter mapping
  const visibleProfiles =
    activeTab === "new"
      ? newCreators
      : activeTab === "approved"
      ? approvedCreators
      : activeTab === "rejected"
      ? rejectedCreators
      : profiles;

  function renderNicheClean(n: string) {
    if (!n) return "—";
    return nicheOptions.includes(n) ? (NICHE_MULTIPLIERS[n]?.label || n) : n.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--mc-bg-primary] px-6">
        <div className="mc-card p-8 w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold text-[--mc-text-primary] mb-1">Internal Control Dashboard</h1>
            <p className="text-sm text-[--mc-text-secondary]">Enter admin credentials to proceed</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label htmlFor="admin-password" className="mc-label">Admin Password</label>
              <input
                id="admin-password"
                type="password"
                className="mc-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                required
              />
            </div>
            <button type="submit" className="mc-btn mc-btn-primary w-full cursor-pointer">
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[--mc-bg-primary]">
      <nav className="glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#6C5CE7] to-[#00D2D3] flex items-center justify-center text-white font-bold text-sm">
              M
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-[#6C5CE7] to-[#00D2D3] bg-clip-text text-transparent">
              MoneyCaption Admin
            </span>
          </div>
          <button
            onClick={() => setIsAuthed(false)}
            className="text-sm text-[--mc-text-secondary] hover:text-[--mc-error] transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        {/* Urgent reviews flashing badge banner */}
        {quickReviewCount > 0 && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 flex items-center justify-between animate-pulse">
            <span className="text-sm font-semibold flex items-center gap-2">
              ⚡ Quick Review Requested for {quickReviewCount} creator screenshot{quickReviewCount > 1 ? "s" : ""}!
            </span>
            <span className="text-xs font-mono uppercase bg-red-500/20 px-2 py-0.5 rounded">Action Required</span>
          </div>
        )}

        {/* Dashboard Title row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[--mc-text-primary]">Creator Control Console</h1>
            <p className="text-sm text-[--mc-text-secondary] mt-1">
              Configure creator accounts, review screenshot verifications, and edit platform handles.
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="mc-btn mc-btn-primary flex-1 sm:flex-none cursor-pointer"
            >
              {showAddForm ? "✕ Hide Add Form" : "+ Add New Creator"}
            </button>
            <button
              onClick={loadData}
              className="mc-btn mc-btn-secondary flex-1 sm:flex-none cursor-pointer"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Manual Add Creator Form */}
        {showAddForm && (
          <form onSubmit={handleAddCreator} className="mc-card p-6 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in text-left">
            <h3 className="font-semibold text-base col-span-1 md:col-span-3 border-b border-[--mc-border] pb-2 text-[--mc-text-primary]">
              Manually Add Creator Account (Direct Approved)
            </h3>
            <div>
              <label className="mc-label">Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Virat Kohli"
                className="mc-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mc-label">Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="mc-input"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mc-label">Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                className="mc-input"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="mc-label">Content Niche *</label>
              <select
                className="mc-input"
                value={newNiche}
                onChange={(e) => setNewNiche(e.target.value)}
                required
              >
                <option value="">Select Niche</option>
                {nicheOptions.map((n) => (
                  <option key={n} value={n}>{renderNicheClean(n)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mc-label">City Location *</label>
              <select
                className="mc-input"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                required
              >
                <option value="">Select City</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[--mc-border] pt-4 mt-2">
              <div>
                <label className="mc-label">Instagram Handle</label>
                <input
                  type="text"
                  placeholder="instagram_handle"
                  className="mc-input"
                  value={newInstagram}
                  onChange={(e) => setNewInstagram(e.target.value)}
                />
              </div>
              <div>
                <label className="mc-label">YouTube Channel</label>
                <input
                  type="text"
                  placeholder="youtube_handle"
                  className="mc-input"
                  value={newYoutube}
                  onChange={(e) => setNewYoutube(e.target.value)}
                />
              </div>
              <div>
                <label className="mc-label">Facebook Handle</label>
                <input
                  type="text"
                  placeholder="facebook_handle"
                  className="mc-input"
                  value={newFacebook}
                  onChange={(e) => setNewFacebook(e.target.value)}
                />
              </div>
              <div>
                <label className="mc-label">Instagram Followers</label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  className="mc-input"
                  value={newFollowersInstagram}
                  onChange={(e) => setNewFollowersInstagram(e.target.value)}
                />
              </div>
              <div>
                <label className="mc-label">YouTube Subscribers</label>
                <input
                  type="number"
                  placeholder="e.g. 100000"
                  className="mc-input"
                  value={newFollowersYoutube}
                  onChange={(e) => setNewFollowersYoutube(e.target.value)}
                />
              </div>
              <div>
                <label className="mc-label">Facebook Followers</label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  className="mc-input"
                  value={newFollowersFacebook}
                  onChange={(e) => setNewFollowersFacebook(e.target.value)}
                />
              </div>
            </div>
            <div className="col-span-1 md:col-span-3 pt-3 flex justify-end">
              <button type="submit" className="mc-btn mc-btn-primary px-8 cursor-pointer">
                ✓ Add Creator Profile
              </button>
            </div>
          </form>
        )}

        {/* Console Category Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[--mc-border] pb-1">
          <button
            onClick={() => setActiveTab("new")}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              activeTab === "new"
                ? "border-[--mc-primary] text-[--mc-primary]"
                : "border-transparent text-[--mc-text-secondary] hover:text-[--mc-text-primary]"
            }`}
          >
            New Creators ({newCreators.length})
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              activeTab === "approved"
                ? "border-[--mc-primary] text-[--mc-primary]"
                : "border-transparent text-[--mc-text-secondary] hover:text-[--mc-text-primary]"
            }`}
          >
            Approved ({approvedCreators.length})
          </button>
          <button
            onClick={() => setActiveTab("rejected")}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              activeTab === "rejected"
                ? "border-[--mc-primary] text-[--mc-primary]"
                : "border-transparent text-[--mc-text-secondary] hover:text-[--mc-text-primary]"
            }`}
          >
            Rejected ({rejectedCreators.length})
          </button>
          <button
            onClick={() => setActiveTab("screenshot")}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === "screenshot"
                ? "border-[--mc-primary] text-[--mc-primary]"
                : "border-transparent text-[--mc-text-secondary] hover:text-[--mc-text-primary]"
            }`}
          >
            Screenshot Queue ({queue.length})
            {quickReviewCount > 0 && (
              <span className="text-[9px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                {quickReviewCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              activeTab === "all"
                ? "border-[--mc-primary] text-[--mc-primary]"
                : "border-transparent text-[--mc-text-secondary] hover:text-[--mc-text-primary]"
            }`}
          >
            All Users ({profiles.length})
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
              activeTab === "stats"
                ? "border-[--mc-primary] text-[--mc-primary]"
                : "border-transparent text-[--mc-text-secondary] hover:text-[--mc-text-primary]"
            }`}
          >
            📊 Stats Dashboard
          </button>
        </div>

        {/* LOADING ANIMATION */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <svg className="animate-spin h-8 w-8 text-[--mc-primary]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* NO ITEMS PLACEHOLDER */}
        {!loading && activeTab !== "screenshot" && activeTab !== "stats" && visibleProfiles.length === 0 && (
          <div className="mc-card p-12 text-center">
            <span className="text-4xl block mb-2">📂</span>
            <p className="text-sm text-[--mc-text-secondary]">No creator profiles found in this category.</p>
          </div>
        )}
        {!loading && activeTab === "screenshot" && queue.length === 0 && (
          <div className="mc-card p-12 text-center">
            <span className="text-4xl block mb-2">✅</span>
            <p className="text-sm text-[--mc-text-secondary]">No screenshot verifications pending review.</p>
          </div>
        )}

        {/* ── LIST VIEW: CREATORS TABS ── */}
        {!loading && activeTab !== "screenshot" && activeTab !== "stats" && visibleProfiles.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {visibleProfiles.map((p) => (
              <div key={p.id} className="mc-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 text-left">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg text-[--mc-text-primary]">{p.name}</h3>
                    {p.approval_status === "pending" ? (
                      <span className="mc-badge mc-badge-yellow">New / Pending</span>
                    ) : p.approval_status === "approved" ? (
                      <span className="mc-badge mc-badge-teal">Approved</span>
                    ) : (
                      <span className="mc-badge mc-badge-grey bg-red-100 text-red-500">Rejected</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[--mc-text-secondary]">
                    <p>📧 {p.email || "No email"}</p>
                    <p>📞 {p.phone || "No phone"}</p>
                    <p>🎨 Niche: <span className="font-semibold text-[--mc-text-primary]">{renderNicheClean(p.niche)}</span></p>
                    {p.instagram_handle && <p>📸 IG: @{p.instagram_handle.replace(/^@/, "")} ({p.followers_instagram?.toLocaleString("en-IN")})</p>}
                    {p.youtube_handle && <p>🎬 YT: @{p.youtube_handle.replace(/^@/, "")} ({p.followers_youtube?.toLocaleString("en-IN")})</p>}
                    {p.facebook_handle && <p>📘 FB: {p.facebook_handle} ({p.followers_facebook?.toLocaleString("en-IN")})</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 md:self-center">
                  {p.approval_status !== "approved" && (
                    <button
                      onClick={() => handleUpdateApprovalStatus(p.id, "approved")}
                      className="mc-btn mc-btn-primary mc-btn-sm bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer border-none"
                    >
                      ✓ Approve
                    </button>
                  )}
                  {p.approval_status !== "rejected" && (
                    <button
                      onClick={() => handleUpdateApprovalStatus(p.id, "rejected")}
                      className="mc-btn mc-btn-secondary mc-btn-sm border-red-500 text-red-500 hover:bg-red-500/10 cursor-pointer"
                    >
                      Block/Reject
                    </button>
                  )}
                  {p.approval_status !== "pending" && (
                    <button
                      onClick={() => handleUpdateApprovalStatus(p.id, "pending")}
                      className="mc-btn mc-btn-secondary mc-btn-sm cursor-pointer"
                    >
                      Move to New
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenDetails(p)}
                    className="mc-btn mc-btn-secondary mc-btn-sm cursor-pointer flex items-center gap-1 hover:bg-[--mc-primary]/10 hover:text-[--mc-primary]"
                  >
                    👁️ View
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(p)}
                    className="mc-btn mc-btn-secondary mc-btn-sm cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCreator(p.id)}
                    className="mc-btn mc-btn-secondary mc-btn-sm border-red-500 text-red-500 hover:bg-red-500/10 cursor-pointer"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── LIST VIEW: SCREENSHOT QUEUE TAB ── */}
        {!loading && activeTab === "screenshot" && queue.length > 0 && (
          <div className="grid grid-cols-1 gap-6">
            {queue.map((item) => {
              const c = item.creator_profiles;
              if (!c) return null;
              return (
                <div key={item.id} className="mc-card p-6 flex flex-col lg:flex-row gap-6 text-left">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg text-[--mc-text-primary]">{c.name}</h3>
                      <span className="mc-badge mc-badge-yellow">Screenshot Verification</span>
                      {c.quick_review_requested && (
                        <span className="mc-badge bg-red-500/20 text-red-500 border border-red-500/20 animate-pulse">
                          ⚡ Quick Review
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[--mc-text-secondary]">
                      <div>
                        <p className="font-semibold text-[--mc-text-primary] mb-1">Platform Handles:</p>
                        {c.instagram_handle && <p>📸 Instagram: @{c.instagram_handle.replace(/^@/, "")} ({c.followers_instagram?.toLocaleString("en-IN")} followers)</p>}
                        {c.youtube_handle && <p>🎬 YouTube: @{c.youtube_handle.replace(/^@/, "")} ({c.followers_youtube?.toLocaleString("en-IN")} subscribers)</p>}
                        {c.facebook_handle && <p>📘 Facebook: {c.facebook_handle} ({c.followers_facebook?.toLocaleString("en-IN")} followers)</p>}
                      </div>
                      <div>
                        <p className="font-semibold text-[--mc-text-primary] mb-1">Details:</p>
                        <p>🎨 Niche: {renderNicheClean(c.niche)}</p>
                        <p>Location: {c.city_tier?.replace("_", " ").toUpperCase()}</p>
                        <p>Uploaded At: {new Date(item.created_at).toLocaleDateString("en-IN")}</p>
                      </div>
                    </div>

                    {c.screenshot_url ? (
                      <div className="pt-2">
                        <p className="text-xs font-semibold text-[--mc-text-secondary] mb-1">Verification Screenshot:</p>
                        <a
                          href={c.screenshot_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block relative rounded-lg border border-[--mc-border] overflow-hidden group hover:border-[--mc-primary] transition-all"
                        >
                          <img
                            src={c.screenshot_url}
                            alt="Verification screenshot"
                            className="max-h-48 rounded-lg object-contain"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium">
                            🔍 Open Full Size
                          </div>
                        </a>
                      </div>
                    ) : (
                      <p className="text-xs text-[--mc-text-secondary] italic">No screenshot file attached.</p>
                    )}
                  </div>

                  {/* Sidebar actions: screenshot calculations */}
                  <div className="lg:w-72 border-l border-[--mc-border] pl-6 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="mc-label">Verify & Edit Engagement Rate (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="100"
                          placeholder="e.g. 4.5"
                          className="mc-input text-sm"
                          value={engagementInputs[item.id] || ""}
                          onChange={(e) =>
                            setEngagementInputs((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="mc-label">Average Reel Views (Optional)</label>
                        <input
                          type="number"
                          placeholder="e.g. 5000"
                          className="mc-input text-sm"
                          value={avgViewsInputs[item.id] || ""}
                          onChange={(e) =>
                            setAvgViewsInputs((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={() => handleEngagementReviewSubmit(item.id, c.id)}
                        className="mc-btn mc-btn-primary mc-btn-sm w-full cursor-pointer"
                      >
                        ✓ Submit Manual Rate Review
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveScreenshot(item.id, c.id)}
                          className="mc-btn mc-btn-primary mc-btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex-1 border-none cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectScreenshot(item.id, c.id)}
                          className="mc-btn mc-btn-secondary mc-btn-sm border-red-500 text-red-500 hover:bg-red-500/10 flex-1 cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── EDIT CREATOR PROFILE MODAL ── */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingProfile(null)} />
          <form
            onSubmit={handleSaveEditCreator}
            className="relative mc-card p-6 w-full max-w-2xl bg-[--mc-bg-card] shadow-2xl animate-fade-in-up text-left max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-[--mc-border] pb-3 mb-4">
              <h3 className="font-bold text-lg text-[--mc-text-primary]">Edit Creator Profile</h3>
              <button
                type="button"
                className="text-lg text-[--mc-text-secondary] hover:text-[--mc-text-primary] cursor-pointer"
                onClick={() => setEditingProfile(null)}
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mc-label">Full Name *</label>
                <input
                  type="text"
                  className="mc-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mc-label">Email Address</label>
                <input
                  type="email"
                  className="mc-input"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
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
                <label className="mc-label">Content Niche *</label>
                <select
                  className="mc-input"
                  value={editNiche}
                  onChange={(e) => setEditNiche(e.target.value)}
                  required
                >
                  {nicheOptions.map((n) => (
                    <option key={n} value={n}>{renderNicheClean(n)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mc-label">City Location *</label>
                <select
                  className="mc-input"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  required
                >
                  {cityOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mc-label">Engagement Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="mc-input"
                  value={editEngagementRate}
                  onChange={(e) => setEditEngagementRate(e.target.value)}
                />
              </div>
              <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[--mc-border] pt-4 mt-2">
                <div>
                  <label className="mc-label">Instagram Handle</label>
                  <input
                    type="text"
                    className="mc-input"
                    value={editInstagram}
                    onChange={(e) => setEditInstagram(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mc-label">YouTube Channel</label>
                  <input
                    type="text"
                    className="mc-input"
                    value={editYoutube}
                    onChange={(e) => setEditYoutube(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mc-label">Facebook Handle</label>
                  <input
                    type="text"
                    className="mc-input"
                    value={editFacebook}
                    onChange={(e) => setEditFacebook(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mc-label">Instagram Followers</label>
                  <input
                    type="number"
                    className="mc-input"
                    value={editFollowersInstagram}
                    onChange={(e) => setEditFollowersInstagram(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mc-label">YouTube Subscribers</label>
                  <input
                    type="number"
                    className="mc-input"
                    value={editFollowersYoutube}
                    onChange={(e) => setEditFollowersYoutube(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mc-label">Facebook Followers</label>
                  <input
                    type="number"
                    className="mc-input"
                    value={editFollowersFacebook}
                    onChange={(e) => setEditFollowersFacebook(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-3 border-t border-[--mc-border]">
              <button
                type="button"
                className="mc-btn mc-btn-secondary cursor-pointer"
                onClick={() => setEditingProfile(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="mc-btn mc-btn-primary px-8 cursor-pointer"
              >
                Save Creator Details
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── STATS DASHBOARD VIEW ── */}
      {!loading && activeTab === "stats" && (
        <main className="max-w-6xl mx-auto px-6 py-6">
          <div className="space-y-8 animate-fade-in text-left">
            <h2 className="text-2xl font-bold text-[--mc-text-primary] mb-6">MoneyCaption System Statistics</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Users */}
              <div className="mc-card p-6 space-y-2">
                <span className="text-xs text-[--mc-text-secondary] font-semibold uppercase tracking-wider block">Total Creators</span>
                <p className="text-3xl font-bold text-white">{profiles.length}</p>
                <div className="flex justify-between items-center text-xs text-[--mc-text-muted] pt-2 border-t border-[--mc-border]">
                  <span>Approved: {profiles.filter((p) => p.approval_status === "approved").length}</span>
                  <span>Pending: {profiles.filter((p) => p.approval_status === "pending").length}</span>
                </div>
              </div>

              {/* Card 2: History Calculations */}
              <div className="mc-card p-6 space-y-2">
                <span className="text-xs text-[--mc-text-secondary] font-semibold uppercase tracking-wider block">Calculations Generated</span>
                <p className="text-3xl font-bold text-white">{totalCalculationsCount}</p>
                <div className="flex justify-between items-center text-xs text-[--mc-text-muted] pt-2 border-t border-[--mc-border]">
                  <span>Active Rates: {totalRateCardsCount}</span>
                </div>
              </div>

              {/* Card 3: User Activity */}
              <div className="mc-card p-6 space-y-2">
                <span className="text-xs text-[--mc-text-secondary] font-semibold uppercase tracking-wider block">PDF Downloads</span>
                <p className="text-3xl font-bold text-white">
                  {profiles.reduce((sum, p) => sum + (p.downloads_count || 0), 0)}
                </p>
                <div className="flex justify-between items-center text-xs text-[--mc-text-muted] pt-2 border-t border-[--mc-border]">
                  <span>Shares / Copy Links: {profiles.reduce((sum, p) => sum + (p.shares_count || 0), 0)}</span>
                </div>
              </div>

              {/* Card 4: Operations Metrics */}
              <div className="mc-card p-6 space-y-2">
                <span className="text-xs text-[--mc-text-secondary] font-semibold uppercase tracking-wider block">Updates & Deletes</span>
                <p className="text-3xl font-bold text-white">
                  {profiles.reduce((sum, p) => sum + (p.updates_count || 0), 0)}
                </p>
                <div className="flex justify-between items-center text-xs text-[--mc-text-muted] pt-2 border-t border-[--mc-border]">
                  <span>Deletes: {profiles.reduce((sum, p) => sum + (p.deletes_count || 0), 0)}</span>
                </div>
              </div>
            </div>

            {/* Platform Distribution Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="mc-card p-6 text-left space-y-4">
                <h3 className="font-bold text-base border-b border-[--mc-border] pb-2">Verification Distribution</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-[--mc-text-secondary]">🛡️ API Verified:</span>
                    <span className="font-bold">{profiles.filter((p) => p.verification_tier === "api_verified").length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[--mc-text-secondary]">📸 Screenshot Verified:</span>
                    <span className="font-bold">{profiles.filter((p) => p.verification_tier === "screenshot_verified").length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[--mc-text-secondary]">○ Self-Reported:</span>
                    <span className="font-bold">{profiles.filter((p) => p.verification_tier === "self_reported").length}</span>
                  </div>
                </div>
              </div>

              <div className="mc-card p-6 text-left space-y-4">
                <h3 className="font-bold text-base border-b border-[--mc-border] pb-2">Account Approval Funnel</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-[--mc-text-secondary] text-emerald-500 font-semibold">Approved:</span>
                    <span className="font-bold text-emerald-500">{profiles.filter((p) => p.approval_status === "approved").length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[--mc-text-secondary] text-amber-500 font-semibold">Pending / New:</span>
                    <span className="font-bold text-amber-500">{profiles.filter((p) => p.approval_status === "pending").length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[--mc-text-secondary] text-red-500 font-semibold">Rejected / Blocked:</span>
                    <span className="font-bold text-red-500">{profiles.filter((p) => p.approval_status === "rejected").length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ── CREATOR DETAILS MODAL ── */}
      {detailModalOpen && selectedCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDetailModalOpen(false)} />
          <div className="relative mc-card p-6 w-full max-w-4xl bg-[--mc-bg-card] shadow-2xl animate-fade-in-up text-left max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-center border-b border-[--mc-border] pb-3">
              <h3 className="font-bold text-lg text-[--mc-text-primary] flex items-center gap-2">
                <span>🛡️ Creator Details Inspection:</span>
                <span className="text-[--mc-primary]">{selectedCreator.name}</span>
              </h3>
              <button
                type="button"
                className="text-lg text-[--mc-text-secondary] hover:text-[--mc-text-primary] cursor-pointer bg-transparent border-none"
                onClick={() => setDetailModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center items-center py-20">
                <svg className="animate-spin h-8 w-8 text-[--mc-primary]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Col 1: Details & Badging Controls */}
                <div className="space-y-6 border-r border-[--mc-border] pr-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm border-b border-[--mc-border] pb-1 uppercase tracking-wider text-[--mc-text-secondary]">General Details</h4>
                    <p className="text-xs"><strong>Email:</strong> {selectedCreator.email || "—"}</p>
                    <p className="text-xs"><strong>Phone:</strong> {selectedCreator.phone || "—"}</p>
                    <p className="text-xs"><strong>Niche:</strong> {renderNicheClean(selectedCreator.niche)}</p>
                    <p className="text-xs"><strong>Location Tier:</strong> {selectedCreator.city_tier}</p>
                    {selectedCreator.instagram_handle && <p className="text-xs">📸 IG: @{selectedCreator.instagram_handle.replace(/^@/, "")} ({selectedCreator.followers_instagram?.toLocaleString()})</p>}
                    {selectedCreator.youtube_handle && <p className="text-xs">🎬 YT: @{selectedCreator.youtube_handle.replace(/^@/, "")} ({selectedCreator.followers_youtube?.toLocaleString()})</p>}
                    {selectedCreator.facebook_handle && <p className="text-xs">📘 FB: {selectedCreator.facebook_handle} ({selectedCreator.followers_facebook?.toLocaleString()})</p>}
                  </div>

                  <div className="space-y-4 pt-2">
                    <h4 className="font-semibold text-sm border-b border-[--mc-border] pb-1 uppercase tracking-wider text-[--mc-text-secondary]">Verification & Approvals</h4>
                    
                    {/* Verification requested alert */}
                    {selectedCreator.profile_verification_requested && (
                      <div className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] p-2 rounded font-semibold animate-pulse">
                        🛡️ Requested profile verification badge!
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[--mc-text-muted] uppercase block">Badge Status</label>
                      <select
                        className="mc-input text-xs py-1.5"
                        value={selectedCreator.verification_tier}
                        onChange={(e) => handleUpdateVerificationTier(selectedCreator.id, e.target.value)}
                      >
                        <option value="self_reported">○ Self-Reported (Unverified)</option>
                        <option value="screenshot_verified">✓ Screenshot Verified</option>
                        <option value="api_verified">✓ API Verified</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[--mc-text-muted] uppercase block">Account Approval Status</label>
                      <select
                        className="mc-input text-xs py-1.5"
                        value={selectedCreator.approval_status}
                        onChange={(e) => handleUpdateApprovalStatus(selectedCreator.id, e.target.value as any)}
                      >
                        <option value="pending">⏳ Pending review</option>
                        <option value="approved">✓ Approved</option>
                        <option value="rejected">❌ Blocked/Rejected</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 text-xs">
                    <h4 className="font-semibold text-sm border-b border-[--mc-border] pb-1 uppercase tracking-wider text-[--mc-text-secondary]">Creator Activity Stats</h4>
                    <p>📄 Downloads: <strong className="text-white">{selectedCreator.downloads_count || 0}</strong></p>
                    <p>🔗 Shares / copies: <strong className="text-white">{selectedCreator.shares_count || 0}</strong></p>
                    <p>⚙️ Profile updates: <strong className="text-white">{selectedCreator.updates_count || 0}</strong></p>
                    <p>🗑️ Deletes: <strong className="text-white">{selectedCreator.deletes_count || 0}</strong></p>
                  </div>
                </div>

                {/* Col 2 & 3: Active Saved Rate Deliverables & Calculations history */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Saved Rates Card */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-[--mc-border] pb-2">
                      <h4 className="font-semibold text-sm text-white">Active Saved Rates</h4>
                      <button
                        onClick={() => handleDownloadSavedCardPdf(selectedCreator, selectedCreatorCards)}
                        disabled={selectedCreatorCards.length === 0}
                        className="mc-btn mc-btn-primary mc-btn-sm text-[10px] py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 border-none cursor-pointer text-white"
                      >
                        📥 Download Rate Card PDF
                      </button>
                    </div>
                    {selectedCreatorCards.length === 0 ? (
                      <p className="text-xs text-[--mc-text-muted] py-2">No deliverables rates saved for this creator yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.entries(
                          selectedCreatorCards.reduce((acc: any, card: any) => {
                            if (!acc[card.platform]) acc[card.platform] = [];
                            if (!acc[card.platform].some((item: any) => item.deliverable_type === card.deliverable_type)) {
                              acc[card.platform].push(card);
                            }
                            return acc;
                          }, {})
                        ).map(([platform, items]: [string, any]) => (
                          <div key={platform} className="bg-[--mc-bg-secondary] p-3 rounded-lg border border-[--mc-border] text-xs">
                            <p className="font-bold capitalize text-white mb-2">
                              {platform === "instagram" ? "📸" : platform === "youtube" ? "🎬" : "📘"} {platform}
                            </p>
                            <div className="space-y-1.5">
                              {items.map((it: any) => (
                                <div key={it.id} className="flex justify-between border-b border-[--mc-border]/30 pb-1 last:border-0">
                                  <span className="text-[--mc-text-secondary] capitalize">
                                    {it.deliverable_type.replace(/_/g, " ").replace(platform, "").trim()}
                                  </span>
                                  <span className="font-semibold text-[--mc-success]">
                                    ₹{parseFloat(it.calculated_rate_median).toLocaleString("en-IN")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Calculations History list */}
                  <div className="space-y-3 pt-2">
                    <h4 className="font-semibold text-sm border-b border-[--mc-border] pb-2 text-white">Rate Calculation History Log</h4>
                    {selectedCreatorHistory.length === 0 ? (
                      <p className="text-xs text-[--mc-text-muted]">No calculations log entries run yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                        {selectedCreatorHistory.map((calc) => (
                          <div key={calc.id} className="p-3 bg-[--mc-bg-secondary] rounded-lg border border-[--mc-border] flex items-center justify-between text-xs">
                            <div>
                              <p className="font-medium text-white">Calculation: {new Date(calc.created_at).toLocaleDateString("en-IN")}</p>
                              <p className="text-[10px] text-[--mc-text-secondary] mt-0.5">
                                Niche: {renderNicheClean(calc.niche)} | Tier: {calc.city_tier} | Badge: {calc.verification_tier}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDownloadHistoryPdf(calc)}
                              className="mc-btn mc-btn-secondary mc-btn-sm text-[10px] py-1 cursor-pointer"
                            >
                              📥 Download historical PDF
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
