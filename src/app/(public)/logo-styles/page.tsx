'use client';

import { useState } from 'react';
import Link from 'next/link';

const GOLD = '#c9a84c';
const WHITE = '#ffffff';
const DARK = '#0a0a0a';
const GREY = '#999999';

type Variant = {
  id: string;
  label: string;
  note: string;
  svg: React.ReactNode;
};

// Crown helper (small structural beam + 2 columns)
function Crown({
  cx = 28,
  topY = 9,
  beamY = 15,
  beamHalf = 20,
  colDx = 8,
  color = GOLD,
  stroke = 2,
}: {
  cx?: number;
  topY?: number;
  beamY?: number;
  beamHalf?: number;
  colDx?: number;
  color?: string;
  stroke?: number;
}) {
  return (
    <>
      <line x1={cx - beamHalf} y1={beamY} x2={cx + beamHalf} y2={beamY} stroke={color} strokeWidth={stroke} />
      <line x1={cx - colDx} y1={beamY} x2={cx - colDx} y2={topY} stroke={color} strokeWidth={stroke} />
      <line x1={cx + colDx} y1={beamY} x2={cx + colDx} y2={topY} stroke={color} strokeWidth={stroke} />
    </>
  );
}

// TT helper (one white T + one gold T centered under crown columns)
function TT({
  cx = 28,
  baseline = 46,
  size = 32,
  leftColor = WHITE,
  rightColor = GOLD,
  weight = 700,
}: {
  cx?: number;
  baseline?: number;
  size?: number;
  leftColor?: string;
  rightColor?: string;
  weight?: number;
}) {
  return (
    <>
      <text x={cx - 8} y={baseline} fontFamily="'Inter', Arial, sans-serif" fontWeight={weight} fontSize={size} fill={leftColor} textAnchor="middle">
        T
      </text>
      <text x={cx + 8} y={baseline} fontFamily="'Inter', Arial, sans-serif" fontWeight={weight} fontSize={size} fill={rightColor} textAnchor="middle">
        T
      </text>
    </>
  );
}

function CompanyText({ x = 68, accentColor = GOLD, mainColor = WHITE, subColor = GREY }: { x?: number; accentColor?: string; mainColor?: string; subColor?: string }) {
  return (
    <>
      <text x={x} y={20} fontFamily="'Inter', Arial, sans-serif" fontWeight={700} fontSize={13} fill={mainColor} letterSpacing="2.5">
        TERCERO TABLADA
      </text>
      <text x={x} y={36} fontFamily="'Inter', Arial, sans-serif" fontWeight={400} fontSize={6.5} fill={subColor} letterSpacing="1.2">
        CIVIL &amp; STRUCTURAL ENGINEERING INC.
      </text>
      <text x={x} y={50} fontFamily="'Inter', Arial, sans-serif" fontWeight={600} fontSize={6} fill={accentColor} letterSpacing="1.5">
        REGISTERED P.E.
      </text>
    </>
  );
}

const variants: Variant[] = [
  {
    id: 'v1',
    label: '01 — Actual (Baseline)',
    note: 'Marco cuadrado outlined, T blanca + T dorada',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0" y="0" width="56" height="56" stroke={GOLD} strokeWidth="1.5" fill="none" rx="3" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v2',
    label: '02 — Marco Dorado Sólido',
    note: 'Cuadro relleno de oro, TT oscuro',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0" y="0" width="56" height="56" fill={GOLD} rx="3" />
        <Crown color={DARK} />
        <TT leftColor={DARK} rightColor={DARK} />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v3',
    label: '03 — Sin Marco',
    note: 'Solo monograma flotante, sin caja',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v4',
    label: '04 — Marco Circular',
    note: 'Anillo dorado en lugar de cuadrado',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <circle cx="28" cy="28" r="27" stroke={GOLD} strokeWidth="1.5" fill="none" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v5',
    label: '05 — Hexágono (Ingeniería)',
    note: 'Forma hexagonal — referencia técnica',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <polygon points="28,1 54,15 54,41 28,55 2,41 2,15" stroke={GOLD} strokeWidth="1.5" fill="none" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v6',
    label: '06 — TT Doble Dorada',
    note: 'Ambas T en oro — premium',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0" y="0" width="56" height="56" stroke={GOLD} strokeWidth="1.5" fill="none" rx="3" />
        <Crown />
        <TT leftColor={GOLD} rightColor={GOLD} />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v7',
    label: '07 — Brackets [TT]',
    note: 'Corchetes minimalistas en vez de cuadro',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        {/* Left bracket */}
        <path d="M 8 1 L 1 1 L 1 55 L 8 55" stroke={GOLD} strokeWidth="1.5" fill="none" />
        {/* Right bracket */}
        <path d="M 48 1 L 55 1 L 55 55 L 48 55" stroke={GOLD} strokeWidth="1.5" fill="none" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v8',
    label: '08 — Línea Inferior',
    note: 'Sin marco, línea dorada bajo TT (cimentación)',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <Crown />
        <TT />
        <line x1="6" y1="54" x2="50" y2="54" stroke={GOLD} strokeWidth="2" />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v9',
    label: '09 — Doble Marco',
    note: 'Marco doble — sello / certificado',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0" y="0" width="56" height="56" stroke={GOLD} strokeWidth="1.5" fill="none" rx="3" />
        <rect x="4" y="4" width="48" height="48" stroke={GOLD} strokeWidth="0.6" fill="none" rx="2" opacity="0.6" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v10',
    label: '10 — Esquinas Cortadas',
    note: 'Marco con esquinas chaflanadas — industrial',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <polygon points="6,0 50,0 56,6 56,50 50,56 6,56 0,50 0,6" stroke={GOLD} strokeWidth="1.5" fill="none" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v11',
    label: '11 — Esquinas Solo (Tick Marks)',
    note: 'Solo las 4 esquinas — encuadre fotográfico',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        {/* TL */}
        <path d="M 0 8 L 0 0 L 8 0" stroke={GOLD} strokeWidth="1.5" fill="none" />
        {/* TR */}
        <path d="M 48 0 L 56 0 L 56 8" stroke={GOLD} strokeWidth="1.5" fill="none" />
        {/* BR */}
        <path d="M 56 48 L 56 56 L 48 56" stroke={GOLD} strokeWidth="1.5" fill="none" />
        {/* BL */}
        <path d="M 8 56 L 0 56 L 0 48" stroke={GOLD} strokeWidth="1.5" fill="none" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v12',
    label: '12 — Marco Dorado Grueso',
    note: 'Borde más prominente — peso editorial',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="1.5" y="1.5" width="53" height="53" stroke={GOLD} strokeWidth="3" fill="none" rx="2" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
];

export default function LogoStylesPage() {
  const [bg, setBg] = useState<'dark' | 'light'>('dark');

  const bgColor = bg === 'dark' ? '#0a0a0a' : '#f5f5f0';
  const cardBg = bg === 'dark' ? '#141414' : '#ffffff';
  const cardBorder = bg === 'dark' ? '#222' : '#e5e5e0';
  const textPrimary = bg === 'dark' ? '#ffffff' : '#0a0a0a';
  const textMuted = bg === 'dark' ? '#888' : '#666';

  return (
    <main style={{ background: bgColor, minHeight: '100vh', paddingBottom: '80px', transition: 'background 0.3s' }}>
      {/* Header */}
      <section
        style={{
          padding: '80px 24px 40px',
          textAlign: 'center',
          maxWidth: '1400px',
          margin: '0 auto',
        }}
      >
        <p style={{ color: GOLD, fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 16px' }}>
          Logo Style Explorer
        </p>
        <h1
          style={{
            color: textPrimary,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(28px, 5vw, 48px)',
            letterSpacing: '-0.02em',
            margin: '0 0 16px',
          }}
        >
          12 Variantes del Logo
        </h1>
        <p style={{ color: textMuted, fontSize: '15px', maxWidth: '600px', margin: '0 auto 32px', lineHeight: 1.6 }}>
          Mismo monograma (TT + corona estructural + dorado). Diferentes tratamientos de marco, color y composición. Elige el que prefieras.
        </p>

        {/* BG toggle */}
        <div
          style={{
            display: 'inline-flex',
            border: `1px solid ${cardBorder}`,
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setBg('dark')}
            style={{
              padding: '10px 20px',
              background: bg === 'dark' ? GOLD : 'transparent',
              color: bg === 'dark' ? DARK : textPrimary,
              border: 'none',
              fontWeight: 600,
              fontSize: '12px',
              letterSpacing: '1.5px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            FONDO OSCURO
          </button>
          <button
            onClick={() => setBg('light')}
            style={{
              padding: '10px 20px',
              background: bg === 'light' ? GOLD : 'transparent',
              color: bg === 'light' ? DARK : textPrimary,
              border: 'none',
              fontWeight: 600,
              fontSize: '12px',
              letterSpacing: '1.5px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            FONDO CLARO
          </button>
        </div>
      </section>

      {/* Grid */}
      <section style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 24px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '20px',
          }}
        >
          {variants.map((v) => (
            <div
              key={v.id}
              style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                borderRadius: '8px',
                padding: '32px 24px 20px',
                transition: 'border-color 0.2s, transform 0.2s',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = GOLD;
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = cardBorder;
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '120px',
                  padding: '20px 0',
                  marginBottom: '20px',
                }}
              >
                <div style={{ width: '100%', maxWidth: '290px' }}>{v.svg}</div>
              </div>
              <div style={{ borderTop: `1px solid ${cardBorder}`, paddingTop: '14px' }}>
                <p style={{ color: textPrimary, fontSize: '13px', fontWeight: 600, margin: '0 0 4px', letterSpacing: '0.5px' }}>{v.label}</p>
                <p style={{ color: textMuted, fontSize: '12px', margin: 0, lineHeight: 1.5 }}>{v.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Back link */}
      <section style={{ textAlign: 'center', padding: '60px 24px 0' }}>
        <Link
          href="/"
          style={{
            color: GOLD,
            fontSize: '13px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            textDecoration: 'none',
            borderBottom: `1px solid ${GOLD}`,
            paddingBottom: '4px',
          }}
        >
          ← Volver al Inicio
        </Link>
      </section>
    </main>
  );
}
