"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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

// Asana-style onboarding illustration
function OnboardingIllustration() {
  return (
    <svg viewBox="0 0 500 500" className="w-full max-w-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background arch with pink fill */}
      <path
        d="M100 450 L100 200 Q100 80 250 80 Q400 80 400 200 L400 450"
        fill="#fce8e8"
        stroke="#f5d0d0"
        strokeWidth="2"
      />

      {/* Clouds */}
      <g>
        {/* Left cloud */}
        <ellipse cx="70" cy="220" rx="35" ry="20" fill="#fce8e8" stroke="#f0c0c0" strokeWidth="1.5"/>
        <ellipse cx="95" cy="210" rx="28" ry="16" fill="#fce8e8" stroke="#f0c0c0" strokeWidth="1.5"/>

        {/* Right cloud top */}
        <ellipse cx="420" cy="180" rx="30" ry="18" fill="#fce8e8" stroke="#f0c0c0" strokeWidth="1.5"/>
        <ellipse cx="445" cy="172" rx="24" ry="14" fill="#fce8e8" stroke="#f0c0c0" strokeWidth="1.5"/>

        {/* Right cloud bottom */}
        <ellipse cx="430" cy="320" rx="25" ry="15" fill="#fce8e8" stroke="#f0c0c0" strokeWidth="1.5"/>
      </g>

      {/* Checkmark circle icon */}
      <g transform="translate(140, 120)">
        <circle cx="30" cy="30" r="28" fill="white" stroke="#e8b4b4" strokeWidth="2"/>
        <path d="M18 30 L26 38 L42 22" stroke="#e07070" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Red notification dot */}
        <circle cx="50" cy="12" r="8" fill="#e85454"/>
      </g>

      {/* Chat bubble icon */}
      <g transform="translate(320, 100)">
        <rect x="0" y="0" width="50" height="38" rx="8" fill="white" stroke="#e8b4b4" strokeWidth="2"/>
        <circle cx="15" cy="19" r="3" fill="#d4a0a0"/>
        <circle cx="25" cy="19" r="3" fill="#d4a0a0"/>
        <circle cx="35" cy="19" r="3" fill="#d4a0a0"/>
        {/* Red notification dot */}
        <circle cx="46" cy="4" r="7" fill="#e85454"/>
      </g>

      {/* Envelope/Mail icon */}
      <g transform="translate(95, 180)">
        <rect x="0" y="0" width="70" height="50" rx="6" fill="white" stroke="#e8b4b4" strokeWidth="2"/>
        <path d="M0 10 L35 32 L70 10" stroke="#e8b4b4" strokeWidth="2" fill="none"/>
        {/* X mark on envelope */}
        <g transform="translate(25, 15)">
          <line x1="0" y1="0" x2="20" y2="20" stroke="#d08080" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="20" y1="0" x2="0" y2="20" stroke="#d08080" strokeWidth="2.5" strokeLinecap="round"/>
        </g>
      </g>

      {/* Bar chart / Analytics icon */}
      <g transform="translate(320, 160)">
        <rect x="0" y="40" width="18" height="35" rx="3" fill="#f0a0a0"/>
        <rect x="24" y="25" width="18" height="50" rx="3" fill="#e88080"/>
        <rect x="48" y="10" width="18" height="65" rx="3" fill="#d06060"/>
      </g>

      {/* Mobile/Card icon */}
      <g transform="translate(280, 220)">
        <rect x="0" y="0" width="45" height="70" rx="6" fill="white" stroke="#e8b4b4" strokeWidth="2"/>
        <rect x="8" y="12" width="29" height="6" rx="2" fill="#f0c0c0"/>
        <rect x="8" y="24" width="20" height="6" rx="2" fill="#f0c0c0"/>
        <rect x="8" y="36" width="29" height="6" rx="2" fill="#f0c0c0"/>
        <rect x="8" y="52" width="14" height="10" rx="2" fill="#e88080"/>
      </g>

      {/* Building/Office illustration */}
      <g transform="translate(170, 260)">
        {/* Main building */}
        <rect x="0" y="40" width="80" height="130" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1"/>

        {/* Windows row 1 */}
        <rect x="12" y="55" width="20" height="25" fill="#e8f4fc" stroke="#d0e8f8" strokeWidth="1"/>
        <rect x="48" y="55" width="20" height="25" fill="#e8f4fc" stroke="#d0e8f8" strokeWidth="1"/>

        {/* Windows row 2 */}
        <rect x="12" y="95" width="20" height="25" fill="#e8f4fc" stroke="#d0e8f8" strokeWidth="1"/>
        <rect x="48" y="95" width="20" height="25" fill="#e8f4fc" stroke="#d0e8f8" strokeWidth="1"/>

        {/* Door */}
        <rect x="28" y="135" width="24" height="35" fill="#6b7280" rx="2"/>
        <circle cx="46" cy="155" r="2" fill="#9ca3af"/>

        {/* Side building */}
        <rect x="80" y="80" width="50" height="90" fill="#ebebeb" stroke="#d8d8d8" strokeWidth="1"/>
        <rect x="90" y="95" width="14" height="18" fill="#e8f4fc" stroke="#d0e8f8" strokeWidth="1"/>
        <rect x="110" y="95" width="14" height="18" fill="#e8f4fc" stroke="#d0e8f8" strokeWidth="1"/>
        <rect x="90" y="125" width="14" height="18" fill="#e8f4fc" stroke="#d0e8f8" strokeWidth="1"/>
        <rect x="110" y="125" width="14" height="18" fill="#e8f4fc" stroke="#d0e8f8" strokeWidth="1"/>
      </g>

      {/* Bottom decorative semicircle (sunrise/sunset) */}
      <path
        d="M140 450 Q250 380 360 450"
        fill="#e07070"
      />

      {/* Ground line */}
      <line x1="100" y1="450" x2="400" y2="450" stroke="#e8c0c0" strokeWidth="2"/>
    </svg>
  );
}

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    if (password && password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/users/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          password: password || undefined,
          image: avatarPreview
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Something went wrong");
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
          {session?.user?.email && (
            <p className="text-slate-600 mb-8">
              You&apos;re signing up as {session.user.email}
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
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10 border-slate-300 focus:border-slate-400 focus:ring-slate-400"
                  placeholder="Your password"
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
              variant="outline"
              className="h-11 px-6 border-slate-300 text-slate-700 hover:bg-slate-50"
              disabled={loading}
            >
              {loading ? "Saving..." : "Continue"}
            </Button>
          </form>

          {/* Info box */}
          <div className="mt-8 p-4 bg-slate-50 rounded-lg border-l-4 border-slate-400">
            <p className="text-sm text-slate-600">
              You&apos;re getting started with BuildSync. You&apos;ll be able to manage projects,
              tasks, and collaborate with your team efficiently.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-rose-50 p-12">
        <OnboardingIllustration />
      </div>
    </div>
  );
}
