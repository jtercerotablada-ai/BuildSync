"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { User, Shield, Bell, Monitor, AlertTriangle, Loader2 } from "lucide-react";
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
      <div className="flex h-full items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Page Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b">
        <h1 className="text-lg md:text-xl font-semibold text-black">Settings</h1>
      </div>

      {/* Mobile: horizontal tab scroll */}
      <div className="md:hidden flex items-center gap-1 px-4 border-b overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0",
                isActive
                  ? "border-slate-900 text-black"
                  : "border-transparent text-gray-500 hover:text-black"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Desktop: vertical sidebar + content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Vertical sidebar (desktop only) */}
        <nav className="hidden md:flex md:flex-col w-56 flex-shrink-0 border-r py-4 px-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-left",
                  isActive
                    ? "bg-gray-100 text-black"
                    : "text-gray-600 hover:bg-gray-50 hover:text-black"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto p-4 md:p-8">
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
      </div>
    </div>
  );
}
