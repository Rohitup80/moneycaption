"use client";

import { useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ScreenshotUploadModalProps {
  profileId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ScreenshotUploadModal({
  profileId,
  onClose,
  onSuccess,
}: ScreenshotUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(selected.type)) {
      setError("Please upload a PNG, JPG, or WebP image.");
      return;
    }

    // Validate file size (max 5MB)
    if (selected.size > 5 * 1024 * 1024) {
      setError("File must be under 5MB.");
      return;
    }

    setFile(selected);
    setError("");

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selected);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      // Generate unique filename
      const ext = file.name.split(".").pop();
      const fileName = `${profileId || "anonymous"}_${Date.now()}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("screenshots")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        // If storage bucket doesn't exist yet, show a helpful message
        if (
          uploadError.message.includes("not found") ||
          uploadError.message.includes("Bucket")
        ) {
          throw new Error(
            "Screenshot storage is being set up. Please try again later or contact support."
          );
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("screenshots")
        .getPublicUrl(fileName);

      // Update creator profile if we have an ID
      if (profileId) {
        await supabase
          .from("creator_profiles")
          .update({
            screenshot_url: urlData.publicUrl,
            screenshot_status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", profileId);

        // Queue for admin review
        await supabase.from("admin_review_queue").insert({
          creator_id: profileId,
          status: "pending",
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const fakeEvent = {
        target: { files: [droppedFile] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative mc-card p-8 w-full max-w-lg animate-fade-in-up opacity-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[--mc-bg-elevated] transition-colors text-[--mc-text-muted] hover:text-[--mc-text-primary]"
        >
          ✕
        </button>

        {success ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">⏳</div>
            <h3 className="text-xl font-bold mb-2">Screenshot Uploaded!</h3>
            <p className="text-sm text-[--mc-text-secondary]">
              Your screenshot is pending review. Once approved, your verification badge will activate!
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-2">
                Upload Engagement Screenshot
              </h3>
              <p className="text-sm text-[--mc-text-secondary]">
                Upload a screenshot of your engagement metrics from Instagram
                Insights, YouTube Studio, or Facebook Creator Studio to earn a
                verified badge.
              </p>
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                preview
                  ? "border-[--mc-primary] bg-[rgba(108,92,231,0.05)]"
                  : "border-[--mc-border] hover:border-[--mc-border-hover]"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />

              {preview ? (
                <div className="space-y-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Screenshot preview"
                    className="max-h-48 mx-auto rounded-lg object-contain"
                  />
                  <p className="text-sm text-[--mc-text-secondary]">
                    {file?.name} (
                    {((file?.size || 0) / 1024 / 1024).toFixed(1)}MB)
                  </p>
                  <button
                    type="button"
                    className="text-sm text-[--mc-primary-light] hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreview(null);
                    }}
                  >
                    Choose a different file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-4xl">📷</div>
                  <p className="text-sm font-medium">
                    Drop your screenshot here, or{" "}
                    <span className="text-[--mc-primary-light]">browse</span>
                  </p>
                  <p className="text-xs text-[--mc-text-muted]">
                    PNG, JPG, or WebP · Max 5MB
                  </p>
                </div>
              )}
            </div>

            {error && <p className="mc-error-text mt-3">{error}</p>}

            {/* Tips */}
            <div className="glass p-4 rounded-lg mt-4">
              <p className="text-xs text-[--mc-text-secondary] leading-relaxed">
                💡 <strong>What to upload:</strong> A screenshot showing your
                engagement rate or engagement metrics from your platform&apos;s
                native analytics (Instagram Insights, YouTube Studio, etc.).
                Make sure your username is visible in the screenshot.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="mc-btn mc-btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="mc-btn mc-btn-primary flex-1"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
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
                    Uploading...
                  </span>
                ) : (
                  "Upload & Verify"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
