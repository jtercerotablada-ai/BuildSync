"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, User, Bell, Lock } from "lucide-react";

export default function ClientSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    jobTitle: "",
    bio: "",
  });
  const [notifications, setNotifications] = useState({
    notifyTaskCompleted: true,
    notifyCommentAdded: true,
    notifyProjectUpdates: true,
    notifyWeeklyDigest: false,
  });
  const [passwords, setPasswords] = useState({
    current: "",
    newPassword: "",
    confirm: "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const session = await res.json();
        if (session?.user) {
          setProfile({
            name: session.user.name || "",
            email: session.user.email || "",
            jobTitle: "",
            bio: "",
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          jobTitle: profile.jobTitle,
          bio: profile.bio,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Profile updated successfully." });
      } else {
        setMessage({ type: "error", text: "Failed to update profile." });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred." });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (passwords.newPassword !== passwords.confirm) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.newPassword,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Password changed successfully." });
        setPasswords({ current: "", newPassword: "", confirm: "" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to change password." });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1
          className="text-2xl font-bold text-white"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Settings
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Manage your profile and preferences.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-[#c9a84c]/10 text-[#a8893a] border border-[#c9a84c]/20"
              : "bg-black/10 text-black border border-black/20"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Profile */}
      <Card className="border-white/10 bg-[#151515]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-white">
            <User className="h-4 w-4 text-[#c9a84c]" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-white/70">Name</Label>
              <Input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="mt-1.5 border-white/10 bg-[#0a0a0a] text-white focus-visible:ring-[#c9a84c]/30"
              />
            </div>
            <div>
              <Label className="text-white/70">Email</Label>
              <Input
                value={profile.email}
                disabled
                className="mt-1.5 border-white/10 bg-[#0a0a0a] text-white/50"
              />
            </div>
          </div>
          <div>
            <Label className="text-white/70">Job Title</Label>
            <Input
              value={profile.jobTitle}
              onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })}
              placeholder="e.g., Project Director"
              className="mt-1.5 border-white/10 bg-[#0a0a0a] text-white placeholder:text-white/30 focus-visible:ring-[#c9a84c]/30"
            />
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className="bg-[#c9a84c] text-black hover:bg-[#b8973f]"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-white/10 bg-[#151515]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-white">
            <Bell className="h-4 w-4 text-[#c9a84c]" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "notifyTaskCompleted" as const, label: "Task completions" },
            { key: "notifyCommentAdded" as const, label: "New comments" },
            { key: "notifyProjectUpdates" as const, label: "Project updates" },
            { key: "notifyWeeklyDigest" as const, label: "Weekly digest email" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <Label className="text-white/70">{item.label}</Label>
              <Switch
                checked={notifications[item.key]}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, [item.key]: checked })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-white/10 bg-[#151515]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-white">
            <Lock className="h-4 w-4 text-[#c9a84c]" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-white/70">Current Password</Label>
            <Input
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              className="mt-1.5 border-white/10 bg-[#0a0a0a] text-white focus-visible:ring-[#c9a84c]/30"
            />
          </div>
          <div>
            <Label className="text-white/70">New Password</Label>
            <Input
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              className="mt-1.5 border-white/10 bg-[#0a0a0a] text-white focus-visible:ring-[#c9a84c]/30"
            />
          </div>
          <div>
            <Label className="text-white/70">Confirm New Password</Label>
            <Input
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              className="mt-1.5 border-white/10 bg-[#0a0a0a] text-white focus-visible:ring-[#c9a84c]/30"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={saving || !passwords.current || !passwords.newPassword}
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
            Update Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
