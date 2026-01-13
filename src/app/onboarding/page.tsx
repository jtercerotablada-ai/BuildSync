"use client";

import { useState, useRef, useCallback, useMemo, Suspense } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Camera, Eye, EyeOff } from "lucide-react";

// Password strength calculator
function calculatePasswordStrength(password: string): { score: number; label: string } {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  return { score: Math.min(score, 4), label: labels[Math.min(score, 4)] };
}

// BuildSync custom illustration - Construction meets Project Management
function OnboardingIllustration() {
  return (
    <svg viewBox="0 0 500 500" className="w-full max-w-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Subtle grid pattern background */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="500" height="500" fill="url(#grid)" opacity="0.5"/>

      {/* Floating connection lines */}
      <g stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6">
        <path d="M120 180 Q200 120 280 160"/>
        <path d="M280 160 Q340 200 380 140"/>
        <path d="M150 320 Q220 280 300 340"/>
      </g>

      {/* Main isometric building blocks */}
      <g transform="translate(140, 200)">
        {/* Base block */}
        <path d="M60 80 L120 50 L120 130 L60 160 Z" fill="#f1f5f9"/>
        <path d="M0 50 L60 80 L60 160 L0 130 Z" fill="#e2e8f0"/>
        <path d="M0 50 L60 20 L120 50 L60 80 Z" fill="#f8fafc"/>

        {/* Middle block */}
        <path d="M60 40 L120 10 L120 90 L60 120 Z" fill="#f1f5f9"/>
        <path d="M0 10 L60 40 L60 120 L0 90 Z" fill="#cbd5e1"/>
        <path d="M0 10 L60 -20 L120 10 L60 40 Z" fill="#e2e8f0"/>

        {/* Top accent block */}
        <path d="M30 -10 L70 -30 L70 10 L30 30 Z" fill="#64748b"/>
        <path d="M-10 -30 L30 -10 L30 30 L-10 10 Z" fill="#475569"/>
        <path d="M-10 -30 L30 -50 L70 -30 L30 -10 Z" fill="#94a3b8"/>
      </g>

      {/* Second building group */}
      <g transform="translate(280, 240)">
        {/* Base */}
        <path d="M50 60 L100 35 L100 95 L50 120 Z" fill="#f1f5f9"/>
        <path d="M0 35 L50 60 L50 120 L0 95 Z" fill="#e2e8f0"/>
        <path d="M0 35 L50 10 L100 35 L50 60 Z" fill="#f8fafc"/>

        {/* Top */}
        <path d="M50 20 L100 -5 L100 55 L50 80 Z" fill="#94a3b8"/>
        <path d="M0 -5 L50 20 L50 80 L0 55 Z" fill="#64748b"/>
        <path d="M0 -5 L50 -30 L100 -5 L50 20 Z" fill="#cbd5e1"/>
      </g>

      {/* Floating task card 1 */}
      <g transform="translate(60, 100)">
        <rect x="0" y="0" width="100" height="70" rx="8" fill="white" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.07))"/>
        <rect x="12" y="12" width="50" height="6" rx="3" fill="#1e293b"/>
        <rect x="12" y="24" width="76" height="4" rx="2" fill="#e2e8f0"/>
        <rect x="12" y="32" width="60" height="4" rx="2" fill="#e2e8f0"/>
        {/* Progress bar */}
        <rect x="12" y="48" width="76" height="6" rx="3" fill="#f1f5f9"/>
        <rect x="12" y="48" width="52" height="6" rx="3" fill="#1e293b"/>
        {/* Checkmark */}
        <circle cx="82" cy="18" r="10" fill="#f1f5f9"/>
        <path d="M78 18 L80 20 L86 14" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>

      {/* Floating task card 2 */}
      <g transform="translate(320, 80)">
        <rect x="0" y="0" width="90" height="60" rx="8" fill="white" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.07))"/>
        <rect x="10" y="10" width="40" height="5" rx="2" fill="#475569"/>
        <rect x="10" y="20" width="70" height="4" rx="2" fill="#e2e8f0"/>
        <rect x="10" y="28" width="55" height="4" rx="2" fill="#e2e8f0"/>
        {/* Avatar dots */}
        <circle cx="18" cy="46" r="8" fill="#cbd5e1"/>
        <circle cx="32" cy="46" r="8" fill="#94a3b8"/>
        <circle cx="46" cy="46" r="8" fill="#64748b"/>
      </g>

      {/* Floating analytics card */}
      <g transform="translate(340, 320)">
        <rect x="0" y="0" width="110" height="80" rx="8" fill="white" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.07))"/>
        <rect x="12" y="12" width="45" height="5" rx="2" fill="#1e293b"/>
        {/* Mini bar chart */}
        <rect x="12" y="55" width="14" height="18" rx="2" fill="#e2e8f0"/>
        <rect x="30" y="45" width="14" height="28" rx="2" fill="#cbd5e1"/>
        <rect x="48" y="35" width="14" height="38" rx="2" fill="#94a3b8"/>
        <rect x="66" y="28" width="14" height="45" rx="2" fill="#64748b"/>
        <rect x="84" y="40" width="14" height="33" rx="2" fill="#1e293b"/>
      </g>

      {/* Sync icon in center */}
      <g transform="translate(235, 175)">
        <circle cx="15" cy="15" r="22" fill="white" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.1))"/>
        <path d="M8 15 A7 7 0 1 1 15 22" stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M22 15 A7 7 0 1 1 15 8" stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M6 12 L8 15 L11 12" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M24 18 L22 15 L19 18" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>

      {/* Construction crane */}
      <g transform="translate(70, 220)">
        {/* Vertical tower */}
        <rect x="8" y="0" width="8" height="140" fill="#94a3b8"/>
        <rect x="6" y="0" width="12" height="8" fill="#64748b"/>
        {/* Horizontal arm */}
        <rect x="0" y="8" width="90" height="6" fill="#64748b"/>
        {/* Cable */}
        <line x1="80" y1="14" x2="80" y2="60" stroke="#475569" strokeWidth="1.5"/>
        {/* Hook */}
        <path d="M76 60 L84 60 L84 70 Q80 75 76 70 Z" fill="#475569"/>
        {/* Counter weight */}
        <rect x="-10" y="8" width="18" height="20" fill="#475569"/>
      </g>

      {/* Floating notification badge */}
      <g transform="translate(180, 90)">
        <circle cx="12" cy="12" r="12" fill="#1e293b"/>
        <text x="12" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="600">3</text>
      </g>

      {/* Small decorative elements */}
      <circle cx="420" cy="420" r="30" fill="#f1f5f9"/>
      <circle cx="430" cy="410" r="20" fill="#e2e8f0"/>

      <circle cx="80" cy="400" r="25" fill="#f1f5f9"/>
      <circle cx="70" cy="390" r="15" fill="#e2e8f0"/>

      {/* Person silhouette with laptop */}
      <g transform="translate(380, 180)">
        {/* Head */}
        <circle cx="25" cy="10" r="12" fill="#cbd5e1"/>
        {/* Body */}
        <path d="M10 25 Q25 35 40 25 L45 60 L5 60 Z" fill="#94a3b8"/>
        {/* Laptop */}
        <rect x="8" y="50" width="34" height="22" rx="3" fill="#475569"/>
        <rect x="11" y="53" width="28" height="16" rx="2" fill="#1e293b"/>
        <rect x="5" y="72" width="40" height="4" rx="1" fill="#64748b"/>
      </g>
    </svg>
  );
}

function OnboardingForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get email from URL params (new registration) or session (OAuth)
  const emailFromParams = searchParams.get("email");
  const email = emailFromParams || session?.user?.email || "";

  const [name, setName] = useState(session?.user?.name || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(session?.user?.image || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordStrength = useMemo(() => calculatePasswordStrength(password), [password]);

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!email) {
      setError("Email is required. Please go back to registration.");
      return;
    }

    setLoading(true);

    try {
      // Complete onboarding
      const response = await fetch("/api/users/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          password,
          image: avatarPreview,
          email,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Something went wrong");
        return;
      }

      // Sign in with the new credentials
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Profile saved but failed to sign in. Please try logging in.");
        return;
      }

      router.push("/home");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = (index: number) => {
    if (index >= passwordStrength.score) return "bg-slate-200";
    if (passwordStrength.score <= 1) return "bg-red-400";
    if (passwordStrength.score === 2) return "bg-amber-400";
    if (passwordStrength.score === 3) return "bg-emerald-400";
    return "bg-emerald-500";
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 bg-white">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-white font-semibold text-base">
              <span>B<span className="text-sm">s</span><span className="text-[10px] ml-[1px]">.</span></span>
            </div>
            <span className="text-xl font-semibold text-slate-900">BuildSync</span>
          </div>

          {/* Welcome text */}
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome to BuildSync!
          </h1>
          {email && (
            <p className="text-slate-600 mb-8">
              You&apos;re signing up as {email}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                {error}
              </div>
            )}

            {/* Avatar upload */}
            <div className="flex items-start gap-6">
              <div className="relative">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-colors overflow-hidden"
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-slate-400" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-slate-300 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <Camera className="w-4 h-4 text-slate-600" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="flex-1 space-y-4">
                {/* Name field */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-700 font-medium">
                    What&apos;s your full name?
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 border-slate-300 focus:border-slate-400 focus:ring-slate-400"
                    placeholder="Your name"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">
                Create a password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10 border-slate-300 focus:border-slate-400 focus:ring-slate-400"
                  placeholder="At least 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Password strength indicator */}
              <div className="space-y-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        password.length > 0 ? getStrengthColor(index) : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-slate-500">
                  Password must be at least 8 characters
                </p>
              </div>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="h-11 px-6 w-full"
              disabled={loading}
            >
              {loading ? "Creating your account..." : "Get Started"}
            </Button>
          </form>

          {/* Info box */}
          <div className="mt-8 p-4 bg-slate-50 rounded-lg border-l-4 border-slate-900">
            <p className="text-sm text-slate-600">
              You&apos;re getting started with BuildSync. You&apos;ll be able to manage projects,
              tasks, and collaborate with your team efficiently.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-50 p-12">
        <OnboardingIllustration />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    }>
      <OnboardingForm />
    </Suspense>
  );
}
