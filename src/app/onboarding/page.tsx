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

  const labels = ["Muy debil", "Debil", "Regular", "Buena", "Muy fuerte"];
  return { score: Math.min(score, 4), label: labels[Math.min(score, 4)] };
}

// Onboarding illustration component
function OnboardingIllustration() {
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background arch */}
      <path
        d="M100 350 L100 180 Q100 80 200 80 Q300 80 300 180 L300 350"
        stroke="#d1d5db"
        strokeWidth="2"
        fill="none"
      />

      {/* Clouds */}
      <g fill="#e5e7eb">
        <ellipse cx="80" cy="200" rx="25" ry="15" />
        <ellipse cx="95" cy="195" rx="20" ry="12" />
        <ellipse cx="320" cy="220" rx="30" ry="18" />
        <ellipse cx="340" cy="215" rx="22" ry="13" />
        <ellipse cx="350" cy="280" rx="20" ry="12" />
      </g>

      {/* Building/chart icon */}
      <g transform="translate(240, 150)">
        <rect x="0" y="30" width="20" height="40" rx="2" fill="#9ca3af" />
        <rect x="25" y="15" width="20" height="55" rx="2" fill="#6b7280" />
        <rect x="50" y="0" width="20" height="70" rx="2" fill="#4b5563" />
      </g>

      {/* Document/envelope icon */}
      <g transform="translate(100, 140)">
        <rect x="0" y="0" width="60" height="45" rx="4" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="2" />
        <path d="M0 10 L30 30 L60 10" stroke="#9ca3af" strokeWidth="2" fill="none" />
        <circle cx="55" cy="5" r="8" fill="#ef4444" />
      </g>

      {/* Chat bubble */}
      <g transform="translate(260, 100)">
        <rect x="0" y="0" width="40" height="30" rx="6" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="2" />
        <circle cx="35" cy="5" r="6" fill="#ef4444" />
      </g>

      {/* Checkmark icon */}
      <g transform="translate(130, 100)">
        <circle cx="20" cy="20" r="18" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="2" />
        <path d="M12 20 L18 26 L28 14" stroke="#4b5563" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Bottom decorative semicircle */}
      <path
        d="M120 350 Q200 280 280 350"
        fill="#9ca3af"
      />

      {/* Construction/building elements */}
      <g transform="translate(170, 200)">
        <rect x="0" y="50" width="60" height="100" fill="#e5e7eb" />
        <rect x="10" y="60" width="15" height="20" fill="#f9fafb" />
        <rect x="35" y="60" width="15" height="20" fill="#f9fafb" />
        <rect x="10" y="90" width="15" height="20" fill="#f9fafb" />
        <rect x="35" y="90" width="15" height="20" fill="#f9fafb" />
        <rect x="22" y="120" width="16" height="30" fill="#6b7280" />
      </g>
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
        setError("La imagen debe ser menor a 5MB");
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
      setError("Por favor ingresa tu nombre");
      return;
    }

    if (password && password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres");
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
        setError(data.error || "Algo salio mal");
        return;
      }

      router.push("/home");
      router.refresh();
    } catch {
      setError("Algo salio mal");
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
            Te damos la bienvenida a BuildSync!
          </h1>
          {session?.user?.email && (
            <p className="text-slate-600 mb-8">
              Te estas registrando como {session.user.email}
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
                    Cual es tu nombre completo?
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 border-slate-300 focus:border-slate-400 focus:ring-slate-400"
                    placeholder="Tu nombre"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">
                Contrasena
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10 border-slate-300 focus:border-slate-400 focus:ring-slate-400"
                  placeholder="Tu contrasena"
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
                  La contrasena debe tener al menos 8 caracteres
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
              {loading ? "Guardando..." : "Continuar"}
            </Button>
          </form>

          {/* Info box */}
          <div className="mt-8 p-4 bg-slate-50 rounded-lg border-l-4 border-slate-400">
            <p className="text-sm text-slate-600">
              Estas comenzando con BuildSync. Podras gestionar proyectos, tareas
              y colaborar con tu equipo de manera eficiente.
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
