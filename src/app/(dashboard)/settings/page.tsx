"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { User, Shield, Bell, Monitor, AlertTriangle } from "lucide-react";
import { ProfileSection } from "@/components/settings/profile-section";
import { SecuritySection } from "@/components/settings/security-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { DisplaySection } from "@/components/settings/display-section";
import { AccountSection } from "@/components/settings/account-section";

type SettingsTab = "profile" | "security" | "notifications" | "display" | "account";

const tabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "display", label: "Display", icon: Monitor },
  { id: "account", label: "Account", icon: AlertTriangle },
];

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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/users/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <nav className="hidden md:flex w-56 flex-col border-r bg-muted/30 p-4 gap-1">
        <h1 className="text-lg font-semibold mb-4 px-3">Settings</h1>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left",
                isActive
                  ? "bg-black text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Mobile tabs */}
      <div className="flex md:hidden border-b overflow-x-auto w-full absolute top-0 left-0 bg-background z-10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap",
                isActive
                  ? "border-black text-black"
                  : "border-transparent text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 mt-12 md:mt-0">
        {activeTab === "profile" && (
          <ProfileSection
            profile={profile}
            onUpdate={(data) => setProfile(data)}
          />
        )}
        {activeTab === "security" && (
          <SecuritySection
            hasOAuth={profile?.hasOAuth ?? false}
            hasPassword={profile?.hasPassword ?? true}
          />
        )}
        {activeTab === "notifications" && <NotificationsSection />}
        {activeTab === "display" && <DisplaySection />}
        {activeTab === "account" && (
          <AccountSection
            name={profile?.name ?? null}
            email={profile?.email ?? null}
            createdAt={profile?.createdAt ?? new Date().toISOString()}
          />
        )}
      </div>
    </div>
  );
}
