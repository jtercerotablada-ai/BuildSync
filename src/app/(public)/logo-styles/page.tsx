'use client';

import { useState } from 'react';
import Link from 'next/link';

const GOLD = '#c9a84c';
const GOLD_BRIGHT = '#d4b65a';
const GOLD_DEEP = '#a8893a';
const WHITE = '#ffffff';
const DARK = '#0a0a0a';
const DARK_2 = '#141414';
const GREY = '#999999';

type Variant = {
  id: string;
  label: string;
  note: string;
  svg: React.ReactNode;
};

// ───────────────────────────────────────────────────────────
// CORE MONOGRAM PRIMITIVES
// ───────────────────────────────────────────────────────────
// Geometry (single source of truth for all variants):
//   - Badge canvas: 56 × 56
//   - Crown beam: y=14, runs x=5 to x=51 (46 wide)
//   - Crown columns: x=18 and x=38 (20 apart, aligned with Ts)
//                    rise from y=14 to y=7 (7 tall)
//   - T1 (white) centered at x=18, baseline y=47, font-size 30
//   - T2 (gold)  centered at x=38, baseline y=47, font-size 30
//   - Inter weight 700, glyph advance ≈ 0.5 × size = 15px
//     → T1 bbox 10.5–25.5, T2 bbox 30.5–45.5 → 5px clean gap

function Crown({
  color = GOLD,
  stroke = 1.5,
  beamX1 = 5,
  beamX2 = 51,
  beamY = 14,
  col1X = 18,
  col2X = 38,
  topY = 7,
}: {
  color?: string;
  stroke?: number;
  beamX1?: number;
  beamX2?: number;
  beamY?: number;
  col1X?: number;
  col2X?: number;
  topY?: number;
}) {
  return (
    <>
      <line x1={beamX1} y1={beamY} x2={beamX2} y2={beamY} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      <line x1={col1X} y1={beamY} x2={col1X} y2={topY} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      <line x1={col2X} y1={beamY} x2={col2X} y2={topY} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
    </>
  );
}

function TT({
  cx1 = 18,
  cx2 = 38,
  baseline = 47,
  size = 30,
  leftColor = WHITE,
  rightColor = GOLD,
  weight = 700,
}: {
  cx1?: number;
  cx2?: number;
  baseline?: number;
  size?: number;
  leftColor?: string;
  rightColor?: string;
  weight?: number;
}) {
  return (
    <>
      <text x={cx1} y={baseline} fontFamily="'Inter', Arial, sans-serif" fontWeight={weight} fontSize={size} fill={leftColor} textAnchor="middle">
        T
      </text>
      <text x={cx2} y={baseline} fontFamily="'Inter', Arial, sans-serif" fontWeight={weight} fontSize={size} fill={rightColor} textAnchor="middle">
        T
      </text>
    </>
  );
}

function CompanyText({
  x = 68,
  accentColor = GOLD,
  mainColor = WHITE,
  subColor = GREY,
}: {
  x?: number;
  accentColor?: string;
  mainColor?: string;
  subColor?: string;
}) {
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

// ───────────────────────────────────────────────────────────
// 12 LOGO VARIANTS
// ───────────────────────────────────────────────────────────

const variants: Variant[] = [
  {
    id: 'v1',
    label: '01 — Outline Cuadrado',
    note: 'Marco fino, T blanca + T dorada · base limpia',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0.75" y="0.75" width="54.5" height="54.5" stroke={GOLD} strokeWidth="1.5" fill="none" rx="3" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v2',
    label: '02 — Sólido Dorado',
    note: 'Cuadro relleno · TT y corona oscuros · alto contraste',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0" y="0" width="56" height="56" fill={GOLD} rx="3" />
        <Crown color={DARK} stroke={1.8} />
        <TT leftColor={DARK} rightColor={DARK} />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v3',
    label: '03 — Sin Marco',
    note: 'Monograma flotante · ligero y aireado',
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
    label: '04 — Círculo',
    note: 'Anillo dorado · proporción premium',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <circle cx="28" cy="28" r="27" stroke={GOLD} strokeWidth="1.5" fill="none" />
        <Crown beamX1={6} beamX2={50} />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v5',
    label: '05 — Hexágono',
    note: 'Forma de ingeniería · referencia técnica',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <polygon points="28,1 54,15 54,41 28,55 2,41 2,15" stroke={GOLD} strokeWidth="1.5" fill="none" />
        <Crown beamX1={7} beamX2={49} />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v6',
    label: '06 — TT Doble Oro',
    note: 'Ambas T en oro · firma premium',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0.75" y="0.75" width="54.5" height="54.5" stroke={GOLD} strokeWidth="1.5" fill="none" rx="3" />
        <Crown />
        <TT leftColor={GOLD} rightColor={GOLD} />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v7',
    label: '07 — Brackets',
    note: 'Corchetes minimalistas [TT] · editorial',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <path d="M 8 1 L 1 1 L 1 55 L 8 55" stroke={GOLD} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 48 1 L 55 1 L 55 55 L 48 55" stroke={GOLD} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v8',
    label: '08 — Línea Inferior',
    note: 'Sin caja · línea dorada bajo TT (cimentación)',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <Crown />
        <TT />
        <line x1="6" y1="54" x2="50" y2="54" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v9',
    label: '09 — Doble Marco (Sello)',
    note: 'Marco con borde interior · feel de certificado',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0.75" y="0.75" width="54.5" height="54.5" stroke={GOLD} strokeWidth="1.5" fill="none" rx="3" />
        <rect x="3.5" y="3.5" width="49" height="49" stroke={GOLD} strokeWidth="0.5" fill="none" rx="1.5" opacity="0.55" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v10',
    label: '10 — Esquinas Chaflán',
    note: 'Marco con esquinas cortadas · industrial',
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
    label: '11 — Esquinas (Tick Marks)',
    note: 'Solo las 4 esquinas · encuadre arquitectónico',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <path d="M 0 8 L 0 0 L 8 0" stroke={GOLD} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 48 0 L 56 0 L 56 8" stroke={GOLD} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 56 48 L 56 56 L 48 56" stroke={GOLD} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 8 56 L 0 56 L 0 48" stroke={GOLD} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v12',
    label: '12 — Negro sobre Oro (Inverso)',
    note: 'Fondo oscuro dentro de marco dorado grueso · luxury',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0" y="0" width="56" height="56" fill={GOLD} rx="3" />
        <rect x="3" y="3" width="50" height="50" fill={DARK} rx="1.5" />
        <Crown color={GOLD} />
        <TT leftColor={WHITE} rightColor={GOLD} />
        <CompanyText />
      </svg>
    ),
  },
];

// ───────────────────────────────────────────────────────────
// PAGE
// ───────────────────────────────────────────────────────────

export default function LogoStylesPage() {
  const [bg, setBg] = useState<'dark' | 'light'>('dark');

  const isDark = bg === 'dark';
  const bgColor = isDark ? DARK : '#f5f5f0';
  const cardBg = isDark ? DARK_2 : '#ffffff';
  const cardBorder = isDark ? '#222' : '#e5e5e0';
  const textPrimary = isDark ? '#ffffff' : DARK;
  const textMuted = isDark ? '#888' : '#666';

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
          Logo Style Explorer · v2 (tipografía corregida)
        </p>
        <h1
          style={{
            color: textPrimary,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(28px, 5vw, 48px)',
            letterSpacing: '-0.02em',
            margin: '0 0 16px',
            lineHeight: 1.1,
          }}
        >
          12 Variantes del Logo
        </h1>
        <p style={{ color: textMuted, fontSize: '15px', maxWidth: '620px', margin: '0 auto 16px', lineHeight: 1.6 }}>
          Monograma TT con corona estructural · paleta oro/blanco. Las T ahora con kerning correcto (sin traslape) y la corona alineada con el centro de cada T.
        </p>
        <p style={{ color: GOLD, fontSize: '12px', fontFamily: 'monospace', margin: '0 auto 32px', opacity: 0.8 }}>
          T centros: x=18 · x=38  ·  font-size 30  ·  gap glifo 5px
        </p>

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
              padding: '10px 22px',
              background: isDark ? GOLD : 'transparent',
              color: isDark ? DARK : textPrimary,
              border: 'none',
              fontWeight: 600,
              fontSize: '12px',
              letterSpacing: '1.5px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            FONDO OSCURO
          </button>
          <button
            onClick={() => setBg('light')}
            style={{
              padding: '10px 22px',
              background: !isDark ? GOLD : 'transparent',
              color: !isDark ? DARK : textPrimary,
              border: 'none',
              fontWeight: 600,
              fontSize: '12px',
              letterSpacing: '1.5px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.2s, color 0.2s',
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
                transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = GOLD;
                el.style.transform = 'translateY(-2px)';
                el.style.boxShadow = isDark ? `0 12px 32px rgba(201,168,76,0.12)` : `0 12px 32px rgba(0,0,0,0.06)`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = cardBorder;
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = 'none';
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

      {/* Detail showcase: large version of baseline */}
      <section
        style={{
          maxWidth: '1400px',
          margin: '60px auto 0',
          padding: '40px 24px',
        }}
      >
        <p style={{ color: GOLD, fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 8px', textAlign: 'center' }}>
          Detalle a tamaño grande
        </p>
        <h2 style={{ color: textPrimary, fontSize: '20px', fontWeight: 700, margin: '0 0 24px', textAlign: 'center', letterSpacing: '-0.01em' }}>
          Inspecciona la tipografía y proporciones
        </h2>
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: '12px',
            padding: '60px 40px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: '100%', maxWidth: '720px' }}>
            <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
              <rect x="0.75" y="0.75" width="54.5" height="54.5" stroke={GOLD} strokeWidth="1.5" fill="none" rx="3" />
              <Crown />
              <TT />
              <CompanyText />
            </svg>
          </div>
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
