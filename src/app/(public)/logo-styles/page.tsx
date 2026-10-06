'use client';

import { useState } from 'react';
import Link from 'next/link';

const GOLD = '#c9a84c';
const GOLD_DEEP = '#a8893a';
const WHITE = '#ffffff';
const DARK = '#0a0a0a';
const DARK_2 = '#141414';
const GREY = '#999999';

type Variant = {
  id: string;
  label: string;
  mood: string;
  analysis: string;
  bestFor: string;
  svg: React.ReactNode;
};

// ═══════════════════════════════════════════════════════════════════
// CORE MONOGRAM PRIMITIVES  ·  edge-touching kerning solution
// ═══════════════════════════════════════════════════════════════════
//
// Inter Bold "T" metrics at font-size 30:
//   - advance width ≈ 16.55 units (0.552 × fontSize)
//   - side-bearings ≈ 1.2 each (0.040 × fontSize) → leaves ~14.15 visible glyph
//   - natural pair-gap (sidebearing × 2) ≈ 2.4 units
//
// To make the two T crossbars TOUCH at the seam (no gap, no overlap),
// we render TT as a single <text> element with negative letterSpacing
// that exactly cancels the combined sidebearings:
//
//   letterSpacing = −(left-sidebearing + right-sidebearing) ≈ −2.4
//
// Using −2.5 collapses the sidebearings cleanly; the visible bars meet
// exactly at the centerline (x = 28 in a 56-wide canvas).
// ═══════════════════════════════════════════════════════════════════

const KERN = -2.5;

function Crown({
  color = GOLD,
  stroke = 1.5,
  beamX1 = 5,
  beamX2 = 51,
  beamY = 14,
  col1X = 21,
  col2X = 35,
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
  cx = 28,
  baseline = 47,
  size = 30,
  leftColor = WHITE,
  rightColor = GOLD,
  weight = 700,
  kern = KERN,
}: {
  cx?: number;
  baseline?: number;
  size?: number;
  leftColor?: string;
  rightColor?: string;
  weight?: number;
  kern?: number;
}) {
  return (
    <text
      x={cx}
      y={baseline}
      fontFamily="'Inter', Arial, sans-serif"
      fontWeight={weight}
      fontSize={size}
      textAnchor="middle"
      letterSpacing={kern}
    >
      <tspan fill={leftColor}>T</tspan>
      <tspan fill={rightColor}>T</tspan>
    </text>
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

// ═══════════════════════════════════════════════════════════════════
// 12 VARIANTS  ·  each one with a specific refinement
// ═══════════════════════════════════════════════════════════════════

const variants: Variant[] = [
  {
    id: 'v1',
    label: '01 — Outline Cuadrado + Divider',
    mood: 'Formal · Clásico',
    analysis:
      'La base. Marco fino + hairline divisor vertical entre el badge y la razón social separa los dos elementos sin agregar peso visual.',
    bestFor: 'Header del sitio, papelería formal, firma de email',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0.75" y="0.75" width="54.5" height="54.5" stroke={GOLD} strokeWidth="1.5" fill="none" rx="3" />
        <Crown />
        <TT />
        <line x1="62" y1="14" x2="62" y2="42" stroke={GOLD} strokeWidth="0.6" opacity="0.5" />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v2',
    label: '02 — Sólido Dorado (Layered)',
    mood: 'Bold · Alto contraste',
    analysis:
      'Cuadro relleno con un borde interno más oscuro de 0.5px. La capa interior agrega profundidad sin perder la pureza del oro.',
    bestFor: 'Tarjetas de presentación, papelería premium, watermarks',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0" y="0" width="56" height="56" fill={GOLD} rx="3" />
        <rect x="2" y="2" width="52" height="52" stroke={GOLD_DEEP} strokeWidth="0.5" fill="none" rx="2" opacity="0.5" />
        <Crown color={DARK} stroke={1.8} />
        <TT leftColor={DARK} rightColor={DARK} />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v3',
    label: '03 — Sin Marco + Ancla',
    mood: 'Aireado · Mínimo',
    analysis:
      'Sin caja contenedora. Una línea dorada corta bajo las T sustituye al marco; ancla el monograma sin enjaularlo.',
    bestFor: 'Versión "lite" en headers transparentes, marcas de agua sutiles',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <Crown />
        <TT />
        <line x1="14" y1="54" x2="42" y2="54" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v4',
    label: '04 — Círculo Doble',
    mood: 'Premium · Stamp',
    analysis:
      'Anillo dorado + anillo interior fino. Lectura como medalla o sello — comunica autoridad técnica y certificación.',
    bestFor: 'Sellos de aprobación, watermarks en planos, badges',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <circle cx="28" cy="28" r="27" stroke={GOLD} strokeWidth="1.5" fill="none" />
        <circle cx="28" cy="28" r="23" stroke={GOLD} strokeWidth="0.5" fill="none" opacity="0.5" />
        <Crown beamX1={7} beamX2={49} />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v5',
    label: '05 — Hexágono (Flat-top)',
    mood: 'Técnico · Moderno',
    analysis:
      'Hexágono con vértices arriba/abajo (no a los lados) — referencia directa a tornillos, tuercas y planos isométricos.',
    bestFor: 'Marca técnica, ingeniería industrial, signage exterior',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <polygon points="14,1 42,1 55,28 42,55 14,55 1,28" stroke={GOLD} strokeWidth="1.5" fill="none" />
        <Crown beamX1={9} beamX2={47} />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v6',
    label: '06 — TT Doble Oro + Cresta',
    mood: 'Premium · Heráldico',
    analysis:
      'Ambas T en oro. Un punto dorado entre los dos picos de la corona refuerza la unión simbólica de los dos apellidos.',
    bestFor: 'Comunicación de prestigio, premios, certificaciones internas',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0.75" y="0.75" width="54.5" height="54.5" stroke={GOLD} strokeWidth="1.5" fill="none" rx="3" />
        <Crown />
        <circle cx="28" cy="7" r="1.2" fill={GOLD} />
        <TT leftColor={GOLD} rightColor={GOLD} />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v7',
    label: '07 — Brackets con Serifs',
    mood: 'Editorial · Refinado',
    analysis:
      'Corchetes con pequeños remates horizontales en los extremos. Sugieren tipografía con serif sin alterar el cuerpo del monograma.',
    bestFor: 'Publicaciones técnicas, white papers, contenido escrito formal',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <path d="M 8 1 L 1 1 L 1 55 L 8 55" stroke={GOLD} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 48 1 L 55 1 L 55 55 L 48 55" stroke={GOLD} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Bracket serifs */}
        <line x1="1" y1="1" x2="4" y2="1" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="1" y1="55" x2="4" y2="55" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="52" y1="1" x2="55" y2="1" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="52" y1="55" x2="55" y2="55" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v8',
    label: '08 — Líneas Sup/Inf (Pillars)',
    mood: 'Arquitectónico · Simétrico',
    analysis:
      'Línea bajo el TT (cimentación) y línea sobre la corona (techo). Las T quedan "entre dos plantas" — referencia a estructuras verticales.',
    bestFor: 'Proyectos verticales, torres residenciales, branding arquitectónico',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <line x1="6" y1="3" x2="50" y2="3" stroke={GOLD} strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
        <Crown />
        <TT />
        <line x1="6" y1="54" x2="50" y2="54" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v9',
    label: '09 — Doble Marco + Esquinas',
    mood: 'Sello · Certificación',
    analysis:
      'Marco exterior + borde interior + pequeñas marcas en las 4 esquinas. Lectura como sello oficial o estampilla de validación.',
    bestFor: 'Documentos firmados, planos sellados, dictámenes técnicos',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0.75" y="0.75" width="54.5" height="54.5" stroke={GOLD} strokeWidth="1.5" fill="none" rx="3" />
        <rect x="3.5" y="3.5" width="49" height="49" stroke={GOLD} strokeWidth="0.6" fill="none" rx="1.5" opacity="0.6" />
        {/* Corner accent marks */}
        <line x1="0" y1="0" x2="2.5" y2="2.5" stroke={GOLD} strokeWidth="0.8" />
        <line x1="56" y1="0" x2="53.5" y2="2.5" stroke={GOLD} strokeWidth="0.8" />
        <line x1="0" y1="56" x2="2.5" y2="53.5" stroke={GOLD} strokeWidth="0.8" />
        <line x1="56" y1="56" x2="53.5" y2="53.5" stroke={GOLD} strokeWidth="0.8" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v10',
    label: '10 — Chaflán Pronunciado',
    mood: 'Industrial · Estructural',
    analysis:
      'Esquinas cortadas a 10px (vs 6px de la versión anterior). El corte más agresivo evoca placas de acero biseladas o piezas mecanizadas.',
    bestFor: 'Estructura metálica, naves industriales, marca técnica pesada',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <polygon points="10,0 46,0 56,10 56,46 46,56 10,56 0,46 0,10" stroke={GOLD} strokeWidth="1.5" fill="none" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v11',
    label: '11 — Tick Marks + Crosshair',
    mood: 'Plano · Topográfico',
    analysis:
      'Marcas de esquina más prominentes (10px) + pequeñas cruces de registro en el centro de cada lado. Lectura como recuadro de plano CAD.',
    bestFor: 'Documentación técnica, branding de drawings, ingeniería digital',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <path d="M 0 10 L 0 0 L 10 0" stroke={GOLD} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 46 0 L 56 0 L 56 10" stroke={GOLD} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 56 46 L 56 56 L 46 56" stroke={GOLD} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 10 56 L 0 56 L 0 46" stroke={GOLD} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Center registration crosses on each edge */}
        <line x1="26" y1="0" x2="30" y2="0" stroke={GOLD} strokeWidth="1" />
        <line x1="28" y1="0" x2="28" y2="2" stroke={GOLD} strokeWidth="1" />
        <line x1="26" y1="56" x2="30" y2="56" stroke={GOLD} strokeWidth="1" />
        <line x1="28" y1="54" x2="28" y2="56" stroke={GOLD} strokeWidth="1" />
        <line x1="0" y1="26" x2="0" y2="30" stroke={GOLD} strokeWidth="1" />
        <line x1="0" y1="28" x2="2" y2="28" stroke={GOLD} strokeWidth="1" />
        <line x1="56" y1="26" x2="56" y2="30" stroke={GOLD} strokeWidth="1" />
        <line x1="54" y1="28" x2="56" y2="28" stroke={GOLD} strokeWidth="1" />
        <Crown />
        <TT />
        <CompanyText />
      </svg>
    ),
  },
  {
    id: 'v12',
    label: '12 — Sello Oro (Luxury)',
    mood: 'Luxury · Inverso',
    analysis:
      'Marco dorado grueso, interior oscuro, TT con T blanca + T dorada. Acabado tipo lingote o joya — la versión más formal de la familia.',
    bestFor: 'Awards, edición limitada, comunicación de alto valor',
    svg: (
      <svg viewBox="0 0 290 60" xmlns="http://www.w3.org/2000/svg" fill="none">
        <rect x="0" y="0" width="56" height="56" fill={GOLD} rx="4" />
        <rect x="2.5" y="2.5" width="51" height="51" fill={DARK} rx="2" />
        <Crown color={GOLD} />
        <TT leftColor={WHITE} rightColor={GOLD} />
        <CompanyText />
      </svg>
    ),
  },
];

// ═══════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════

export default function LogoStylesPage() {
  const [bg, setBg] = useState<'dark' | 'light'>('dark');
  const [showAnalysis, setShowAnalysis] = useState(true);

  const isDark = bg === 'dark';
  const bgColor = isDark ? DARK : '#f5f5f0';
  const cardBg = isDark ? DARK_2 : '#ffffff';
  const cardBorder = isDark ? '#222' : '#e5e5e0';
  const textPrimary = isDark ? '#ffffff' : DARK;
  const textMuted = isDark ? '#888' : '#666';
  const textBody = isDark ? '#bbb' : '#444';

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
          Logo Style Explorer · v3 (kerning + refinamientos)
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
          12 Variantes con Análisis
        </h1>
        <p style={{ color: textMuted, fontSize: '15px', maxWidth: '680px', margin: '0 auto 16px', lineHeight: 1.6 }}>
          Las dos T ahora se tocan exactamente en el borde gracias a un letter-spacing de −2.5 que cancela los sidebearings de Inter Bold. Cada variante agrega un detalle de diseño específico — abajo está el análisis y el caso de uso recomendado.
        </p>
        <p style={{ color: GOLD, fontSize: '12px', fontFamily: 'monospace', margin: '0 auto 32px', opacity: 0.8 }}>
          TT centrada en x=28 · letter-spacing=−2.5 · columnas corona x=21/35
        </p>

        <div style={{ display: 'inline-flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
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
              }}
            >
              FONDO CLARO
            </button>
          </div>
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            style={{
              padding: '10px 22px',
              background: showAnalysis ? GOLD : 'transparent',
              color: showAnalysis ? DARK : textPrimary,
              border: `1px solid ${showAnalysis ? GOLD : cardBorder}`,
              borderRadius: '999px',
              fontWeight: 600,
              fontSize: '12px',
              letterSpacing: '1.5px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {showAnalysis ? 'OCULTAR ANÁLISIS' : 'MOSTRAR ANÁLISIS'}
          </button>
        </div>
      </section>

      {/* Grid */}
      <section style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 24px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
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
                padding: '24px 24px 20px',
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
              <p style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 600 }}>{v.mood}</p>
              <p style={{ color: textPrimary, fontSize: '14px', fontWeight: 700, margin: '0 0 18px', letterSpacing: '0.3px' }}>{v.label}</p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '120px',
                  padding: '20px 0',
                  marginBottom: showAnalysis ? '16px' : '0',
                }}
              >
                <div style={{ width: '100%', maxWidth: '290px' }}>{v.svg}</div>
              </div>

              {showAnalysis && (
                <div style={{ borderTop: `1px solid ${cardBorder}`, paddingTop: '14px' }}>
                  <p style={{ color: textBody, fontSize: '12px', margin: '0 0 10px', lineHeight: 1.55 }}>{v.analysis}</p>
                  <p style={{ color: textMuted, fontSize: '11px', margin: 0, lineHeight: 1.5 }}>
                    <span style={{ color: GOLD, fontWeight: 600 }}>Ideal para:</span> {v.bestFor}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Kerning demo */}
      <section style={{ maxWidth: '1400px', margin: '60px auto 0', padding: '40px 24px' }}>
        <p style={{ color: GOLD, fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 8px', textAlign: 'center' }}>
          Detalle del kerning · zoom
        </p>
        <h2 style={{ color: textPrimary, fontSize: '20px', fontWeight: 700, margin: '0 0 24px', textAlign: 'center', letterSpacing: '-0.01em' }}>
          Los bordes de las T se tocan en la línea central
        </h2>
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: '12px',
            padding: '40px 32px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {[
            { kern: 0, label: 'Sin kerning', note: 'Sidebearings dejan ~2.4px de gap' },
            { kern: -2.5, label: 'kern = −2.5 (actual)', note: 'Bordes tocándose exactamente' },
            { kern: -5, label: 'kern = −5 (demasiado)', note: 'Las T se traslapan visiblemente' },
          ].map((demo) => (
            <div key={demo.kern} style={{ textAlign: 'center' }}>
              <svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: '160px', display: 'block', margin: '0 auto 12px' }}>
                <rect x="0.75" y="0.75" width="54.5" height="54.5" stroke={GOLD} strokeWidth="1.5" fill="none" rx="3" />
                <Crown />
                <TT kern={demo.kern} />
              </svg>
              <p style={{ color: textPrimary, fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }}>{demo.label}</p>
              <p style={{ color: textMuted, fontSize: '11px', margin: 0 }}>{demo.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Large detail */}
      <section style={{ maxWidth: '1400px', margin: '40px auto 0', padding: '40px 24px' }}>
        <p style={{ color: GOLD, fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 8px', textAlign: 'center' }}>
          Tamaño grande · v1 baseline
        </p>
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
              <line x1="62" y1="14" x2="62" y2="42" stroke={GOLD} strokeWidth="0.6" opacity="0.5" />
              <CompanyText />
            </svg>
          </div>
        </div>
      </section>

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
