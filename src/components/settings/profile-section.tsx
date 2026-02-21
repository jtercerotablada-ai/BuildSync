"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ProfileData {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  jobTitle: string | null;
  bio: string | null;
  emailVerified: string | null;
  hasOAuth: boolean;
  hasPassword: boolean;
  createdAt: string;
}

interface ProfileSectionProps {
  profile: ProfileData | null;
  onUpdate: (data: ProfileData) => void;
}

export function ProfileSection({ profile, onUpdate }: ProfileSectionProps) {
  const [name, setName] = useState(profile?.name || "");
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [image, setImage] = useState(profile?.image || "");
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);

  const initials =
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, jobTitle, bio, image }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const updated = await res.json();
      onUpdate({ ...profile!, ...updated });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleImageUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function handleResendVerification() {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      toast.success(data.message || "Verification email sent");
    } catch {
      toast.error("Failed to send verification email");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Manage your personal information
        </p>
      </div>

      {/* Email verification banner */}
      {profile && !profile.emailVerified && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">
              Your email is not verified
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              Check your inbox for a verification link, or request a new one.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendVerification}
            disabled={resending}
            className="shrink-0 border-amber-300 text-amber-900 hover:bg-amber-100"
          >
            {resending ? "Sending..." : "Resend"}
          </Button>
        </div>
      )}

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative group cursor-pointer" onClick={handleImageUpload}>
          <Avatar className="h-20 w-20">
            <AvatarImage src={image} />
            <AvatarFallback className="bg-black text-white text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-5 w-5 text-white" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Profile photo</p>
          <p className="text-xs text-muted-foreground">
            Click to upload a new photo
          </p>
        </div>
      </div>

      {/* Fields */}
      <div className="grid gap-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="email">Email</Label>
            {profile?.emailVerified && (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                <CheckCircle className="h-3 w-3" />
                Verified
              </span>
            )}
          </div>
          <Input
            id="email"
            value={profile?.email || ""}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            Email cannot be changed
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jobTitle">Job title</Label>
          <Input
            id="jobTitle"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Product Manager"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself"
            rows={3}
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save changes"}
      </Button>
    </div>
  );
}
