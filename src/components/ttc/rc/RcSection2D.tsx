'use client';

import React from 'react';
import type { BeamInput, BeamAnalysis } from '@/lib/rc/types';
import { lookupBar } from '@/lib/rc/types';

interface Props {
  input: BeamInput;
  result: BeamAnalysis;
}

/**
 * RcSection2D — three-pane diagram (Cross Section · Strain · Whitney Stress Block).
 *
 * Style: textbook / academic (Wight & MacGregor, ACI MNL-17).
 * Conventions:
 *   • Single shared Y axis: the neutral axis (NA) line is horizontal across all three panes.
 *   • Strain diagram: εcu = +0.003 at top compression fiber, 0 at NA, εt at d.
 *   • Whitney block: uniform 0.85·f'c over depth a = β1·c, with C and T force arrows.
 *   • All dimensions drafted with extension lines + double-headed arrows + value text.
 */
export function RcSection2D({ input, result }: Props) {
  const W = 1100, H = 680;                   // taller canvas → breathing room
  const padX = 30, padY = 80, padBottom = 140;   // more room above titles & below

  // Pane widths
  const sectionW = 290;
  const strainW = 300;
  const stressW = 340;
  const gap = 30;

  const sectionX = padX;
  const strainX = sectionX + sectionW + gap;
  const stressX = strainX + strainW + gap;
  void stressW;

  // Section dimensions
  const g = input.geometry;
  const r = input.reinforcement;
  const beamH = H - padY - padBottom;
  const scaleY = beamH / g.h;     // mm → px (vertical)

  // Horizontal scale: choose based on widest dimension (bf for T/L/inv-T)
  const widestSection = g.shape !== 'rectangular' ? Math.max(g.bf ?? g.bw, g.bw) : g.bw;
  const scaleX = sectionW / widestSection * 0.55;     // tighter so dim lines fit
  const scaleBar = Math.min(scaleX, scaleY);

  const sectionCx = sectionX + sectionW / 2;
  const sectionTop = padY;
  const sectionBot = padY + beamH;

  // Bar diameters (mm)
  const stirrupDb = lookupBar(r.stirrup.bar)?.db ?? 9.5;
  const dbTens = lookupBar(r.tension[0]?.bar ?? '#9')?.db ?? 25;
  const dbComp = lookupBar(r.compression?.[0]?.bar ?? '#4')?.db ?? 12.7;
  const dbSkin = r.skin ? (lookupBar(r.skin.bar)?.db ?? 12) : 0;
  void dbSkin;

  // Bar Y positions
  const yTens = sectionTop + g.d * scaleY;
  const yComp = sectionTop + (g.dPrime ?? 50) * scaleY;
  const yNA = sectionTop + result.flexure.c * scaleY;     // Neutral axis Y (px)
  const aPx = result.flexure.a * scaleY;
  const cPx = result.flexure.c * scaleY;

  // Pre-compute pixel widths per shape — needed BEFORE web edges
  const bfPx = (g.bf ?? g.bw) * scaleX;
  const bwPx = g.bw * scaleX;
  const widestPx = Math.max(bfPx, bwPx);

  // Outer envelope (= section bounding-box). Section is always centered on
  // sectionCx within its own bbox so dim lines (h, c, d, etc.) hug the OUTSIDE
  // of any flange overhang.
  const outerLeft = g.shape === 'rectangular' ? sectionCx - bwPx / 2 : sectionCx - widestPx / 2;
  const outerRight = g.shape === 'rectangular' ? sectionCx + bwPx / 2 : sectionCx + widestPx / 2;

  // Web edges — for L-beam, the web is right-aligned inside the bbox; for
  // rectangular / T-beam / inverted-T, the web is centered.
  const webL = g.shape === 'L-beam' ? outerRight - bwPx : sectionCx - bwPx / 2;
  const webR = g.shape === 'L-beam' ? outerRight : sectionCx + bwPx / 2;
  const secLeft = webL;
  const secRight = webR;
  const stirOutLeft = secLeft + g.coverClear * scaleX;
  const stirOutRight = secRight - g.coverClear * scaleX;
  const stirInLeft = stirOutLeft + stirrupDb * scaleX;
  const stirInRight = stirOutRight - stirrupDb * scaleX;

  // Strain diagram axis
  const strainCx = strainX + 80;
  const strainAxisX = strainCx;
  const strainMaxOff = 100;     // max offset from axis (compression side)

  // Stress diagram
  const stressLeft = stressX + 30;
  const stressBlockW = 130;
  const stressRight = stressLeft + stressBlockW;

  // Helper: Format
  const fmt = (n: number, d = 1) => n.toFixed(d);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto',
                  background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)' }}>

      <defs>
        {/* Dimension arrow markers (light steel for dark theme) */}
        <marker id="dim-arrow-end" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
        <marker id="dim-arrow-start" viewBox="0 0 10 10" refX="1" refY="5"
                markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#cbd5e1" />
        </marker>
        {/* Force arrow markers — both default points +X (apex on right) so
            orient="auto" rotates them correctly to follow line direction. */}
        <marker id="force-c" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#e2766b" />
        </marker>
        <marker id="force-t" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#5fb674" />
        </marker>
      </defs>

      {/* ═════════════════════════ SHARED NEUTRAL AXIS ═════════════════════════ */}
      <line x1={padX} y1={yNA} x2={W - padX} y2={yNA}
            stroke="#76b6c9" strokeWidth="0.7" strokeDasharray="6 4" opacity="0.7" />
      {/* NA label sits in the GAP between strain pane and Whitney pane (visually
          centered between the two diagrams, not pinned to far right). */}
      <text x={(strainX + strainW + stressX) / 2} y={yNA - 5} textAnchor="middle"
            fontSize="9" fontStyle="italic" fill="#76b6c9">
        Neutral Axis · c = {fmt(result.flexure.c)} mm
      </text>

      {/* ═══════════════════ PANE 1 — CROSS SECTION ═══════════════════ */}
      <g>
        <text x={sectionCx} y={padY - 50} textAnchor="middle" fontSize="13" fontWeight="700" fill="rgba(255,255,255,0.92)">
          CROSS SECTION
        </text>

        {/* Section outline — single composed polygon per shape so the join is clean */}
        {(() => {
          const fill = "rgba(180,180,180,0.18)";
          const stroke = "rgba(255,255,255,0.45)";
          if (g.shape === 'rectangular') {
            return (
              <rect x={secLeft} y={sectionTop}
                    width={g.bw * scaleX} height={g.h * scaleY}
                    fill={fill} stroke={stroke} strokeWidth="1.5" />
            );
          }
          const bf = g.bf ?? g.bw;
          const hf = g.hf ?? 120;
          const bfPx = bf * scaleX;
          const bwPx = g.bw * scaleX;
          const hfPx = hf * scaleY;
          const hPx = g.h * scaleY;

          if (g.shape === 'inverted-T') {
            // Web on top (centered), flange on bottom (full bf)
            const webL = sectionCx - bwPx / 2;
            const flangeL = sectionCx - bfPx / 2;
            const yWebBot = sectionTop + (hPx - hfPx);
            const path =
              `M ${webL} ${sectionTop} ` +
              `L ${webL + bwPx} ${sectionTop} ` +
              `L ${webL + bwPx} ${yWebBot} ` +
              `L ${flangeL + bfPx} ${yWebBot} ` +
              `L ${flangeL + bfPx} ${sectionTop + hPx} ` +
              `L ${flangeL} ${sectionTop + hPx} ` +
              `L ${flangeL} ${yWebBot} ` +
              `L ${webL} ${yWebBot} Z`;
            return <path d={path} fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="miter" />;
          }
          if (g.shape === 'L-beam') {
            // Asymmetric L: bounding box centered on sectionCx; web is right-aligned
            // inside the bbox, flange spans the full bbox width (= bf) over hf.
            const bboxL = sectionCx - bfPx / 2;
            const bboxR = sectionCx + bfPx / 2;
            const webR = bboxR;
            const webL = bboxR - bwPx;
            const path =
              `M ${bboxL} ${sectionTop} ` +
              `L ${webR} ${sectionTop} ` +
              `L ${webR} ${sectionTop + hPx} ` +
              `L ${webL} ${sectionTop + hPx} ` +
              `L ${webL} ${sectionTop + hfPx} ` +
              `L ${bboxL} ${sectionTop + hfPx} Z`;
            return <path d={path} fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="miter" />;
          }
          // Default: T-beam — flange on top, web below, both centered
          const webL = sectionCx - bwPx / 2;
          const flangeL = sectionCx - bfPx / 2;
          const path =
            `M ${flangeL} ${sectionTop} ` +
            `L ${flangeL + bfPx} ${sectionTop} ` +
            `L ${flangeL + bfPx} ${sectionTop + hfPx} ` +
            `L ${webL + bwPx} ${sectionTop + hfPx} ` +
            `L ${webL + bwPx} ${sectionTop + hPx} ` +
            `L ${webL} ${sectionTop + hPx} ` +
            `L ${webL} ${sectionTop + hfPx} ` +
            `L ${flangeL} ${sectionTop + hfPx} Z`;
          return <path d={path} fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="miter" />;
        })()}

        {/* Stirrup outline (light dashed inset, no hooks) */}
        {(() => {
          const cx1 = stirOutLeft + (stirrupDb / 2) * scaleX;
          const cx2 = stirOutRight - (stirrupDb / 2) * scaleX;
          const cy1 = sectionTop + (g.coverClear + stirrupDb / 2) * scaleY;
          const cy2 = sectionTop + (g.h - g.coverClear - stirrupDb / 2) * scaleY;
          const rxCorner = 2 * stirrupDb * scaleBar;
          return (
            <rect x={cx1} y={cy1} width={cx2 - cx1} height={cy2 - cy1}
                  rx={rxCorner} ry={rxCorner}
                  fill="none" stroke="#76b6c9" strokeWidth="1.2"
                  strokeLinejoin="round" />
          );
        })()}

        {/* Tension bars */}
        {(() => {
          const total = r.tension.reduce((s, b) => s + b.count, 0);
          if (total === 0) return null;
          const halfBar = (dbTens / 2) * scaleX;
          const xLeft = stirInLeft + halfBar;
          const xRight = stirInRight - halfBar;
          const xUsable = Math.max(xRight - xLeft, 1);
          const dx = total > 1 ? xUsable / (total - 1) : 0;
          const yInnerBot = sectionTop + (g.h - g.coverClear - stirrupDb) * scaleY;
          const yBar = Math.min(yTens, yInnerBot - (dbTens / 2) * scaleY);
          return Array.from({ length: total }, (_, i) => (
            <circle key={`t-${i}`}
              cx={total === 1 ? sectionCx : xLeft + i * dx}
              cy={yBar}
              r={(dbTens / 2) * scaleBar}
              fill="#cbd5e1" stroke="#e2e8f0" strokeWidth="0.6" />
          ));
        })()}

        {/* Compression bars */}
        {(r.compression?.length ?? 0) > 0 && (() => {
          const totalC = (r.compression ?? []).reduce((s, b) => s + b.count, 0);
          if (totalC === 0) return null;
          const halfBar = (dbComp / 2) * scaleX;
          const xLeft = stirInLeft + halfBar;
          const xRight = stirInRight - halfBar;
          const xUsable = Math.max(xRight - xLeft, 1);
          const dx = totalC > 1 ? xUsable / (totalC - 1) : 0;
          const yInnerTop = sectionTop + (g.coverClear + stirrupDb) * scaleY;
          const yBar = Math.max(yComp, yInnerTop + (dbComp / 2) * scaleY);
          return Array.from({ length: totalC }, (_, i) => (
            <circle key={`c-${i}`}
              cx={totalC === 1 ? sectionCx : xLeft + i * dx}
              cy={yBar}
              r={(dbComp / 2) * scaleBar}
              fill="#cbd5e1" stroke="#e2e8f0" strokeWidth="0.6" />
          ));
        })()}

        {/* Skin reinforcement */}
        {r.skin && r.skin.countPerFace > 0 && (() => {
          const sk = r.skin!;
          const halfBar = (dbSkin / 2) * scaleX;
          const xL = stirInLeft + halfBar;
          const xR = stirInRight - halfBar;
          const skinBot = yTens - (dbTens / 2) * scaleY - 30 * scaleY;
          const skinTop = sectionTop + (g.h / 2) * scaleY;
          const span = Math.max(skinBot - skinTop, 1);
          const dy = sk.countPerFace > 1 ? span / (sk.countPerFace - 1) : 0;
          return Array.from({ length: sk.countPerFace }, (_, i) => (
            <g key={`sk-${i}`}>
              <circle cx={xL} cy={skinTop + i * dy} r={(dbSkin / 2) * scaleBar}
                      fill="#76b6c9" stroke="#3a6a8a" strokeWidth="0.5" />
              <circle cx={xR} cy={skinTop + i * dy} r={(dbSkin / 2) * scaleBar}
                      fill="#76b6c9" stroke="#3a6a8a" strokeWidth="0.5" />
            </g>
          ));
        })()}

        {/* === DIMENSION LINES === */}
        {/* Bottom width dim — bw for rectangular/T/L (web at bottom), bf for inverted-T */}
        {(() => {
          const isInvT = g.shape === 'inverted-T';
          const widthLabel = isInvT
            ? `bf = ${g.bf ?? g.bw} mm`
            : `bw = ${g.bw} mm`;
          const xL = isInvT ? sectionCx - bfPx / 2 : secLeft;
          const xR = isInvT ? sectionCx + bfPx / 2 : secRight;
          return <DimLineH y={sectionBot + 22} x1={xL} x2={xR} label={widthLabel} />;
        })()}
        {/* Top width dim — only for non-rectangular: bf at top for T/L, bw at top for inv-T */}
        {g.shape !== 'rectangular' && (() => {
          const isInvT = g.shape === 'inverted-T';
          const topLabel = isInvT
            ? `bw = ${g.bw} mm`
            : `bf = ${g.bf ?? g.bw} mm`;
          const xL = isInvT ? sectionCx - bwPx / 2 : sectionCx - bfPx / 2;
          const xR = isInvT ? sectionCx + bwPx / 2 : sectionCx + bfPx / 2;
          // For L-beam, top width is along the right-aligned bbox
          const lWebR = sectionCx + bfPx / 2;
          const lXL = g.shape === 'L-beam' ? lWebR - bfPx : xL;
          const lXR = g.shape === 'L-beam' ? lWebR : xR;
          return <DimLineH y={sectionTop - 14} x1={lXL} x2={lXR}
                           label={topLabel} color="#cbd5e1" />;
        })()}
        {/* h — full height on left side (text further LEFT of line) */}
        <DimLineV x={outerLeft - 38} y1={sectionTop} y2={sectionBot}
                  label={`h = ${g.h} mm`} textOffset={-14} />
        {/* d — top to tension steel centroid (right side, text RIGHT of line) */}
        <DimLineV x={outerRight + 16} y1={sectionTop} y2={yTens}
                  label={`d = ${g.d} mm`} color="#ff8a72" textOffset={14} />
        {/* c — top to neutral axis (left side, text LEFT of line) */}
        <DimLineV x={outerLeft - 12} y1={sectionTop} y2={yNA}
                  label={`c = ${fmt(result.flexure.c)} mm`} color="#76b6c9" textOffset={-14} />
        {/* d-c — NA to tension steel (far right, text RIGHT of line) */}
        <DimLineV x={outerRight + 38} y1={yNA} y2={yTens}
                  label={`d - c = ${fmt(g.d - result.flexure.c)}`} color="rgba(255,255,255,0.6)" textOffset={14} />

        {/* hf dim for non-rectangular sections — small flange-thickness callout */}
        {g.shape !== 'rectangular' && (() => {
          const hfPxLocal = (g.hf ?? 120) * scaleY;
          const isInvT = g.shape === 'inverted-T';
          // For inverted-T, flange is at bottom; for others, at top
          const yA = isInvT ? sectionBot - hfPxLocal : sectionTop;
          const yB = isInvT ? sectionBot : sectionTop + hfPxLocal;
          // Place dim INSIDE the section on the right side of the web
          const xLine = sectionCx + bwPx / 2 + 3;
          return (
            <g>
              <line x1={xLine} y1={yA} x2={xLine + 8} y2={yA} stroke="#c9a84c" strokeWidth="0.4" strokeDasharray="2 1" />
              <line x1={xLine} y1={yB} x2={xLine + 8} y2={yB} stroke="#c9a84c" strokeWidth="0.4" strokeDasharray="2 1" />
              <text x={xLine + 12} y={(yA + yB) / 2 + 3}
                    fontSize="8.5" fontStyle="italic" fill="#c9a84c">
                hf = {g.hf ?? 120}
              </text>
            </g>
          );
        })()}

        {/* As label below the b-dimension line, with safe spacing from footer */}
        <text x={sectionCx} y={sectionBot + 42} textAnchor="middle"
              fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.92)">
          {`As = ${result.flexure.As.toFixed(0)} mm² (${r.tension.map((bg) => `${bg.count} ${bg.bar}`).join(' + ')})`}
        </text>
      </g>

      {/* ═══════════════════ PANE 2 — STRAIN DIAGRAM ═══════════════════ */}
      <g>
        <text x={strainX + strainW / 2} y={padY - 50} textAnchor="middle" fontSize="13" fontWeight="700" fill="rgba(255,255,255,0.92)">
          STRAIN DIAGRAM
        </text>

        {/* Vertical reference axis (the section centroid axis projection) */}
        <line x1={strainAxisX} y1={sectionTop} x2={strainAxisX} y2={sectionBot}
              stroke="rgba(255,255,255,0.55)" strokeWidth="1" />

        {/* Horizontal top + bottom reference lines */}
        <line x1={strainAxisX - 8} y1={sectionTop} x2={strainAxisX + strainMaxOff + 30} y2={sectionTop}
              stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
        <line x1={strainAxisX - 8} y1={yTens} x2={strainAxisX + strainMaxOff + 30} y2={yTens}
              stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />

        {/* Strain triangle:
            - Compression side (LEFT of axis): 0.003 at top, 0 at NA, then 0 below NA (compression only above NA)
            - Tension side (RIGHT of axis): 0 at NA, εt at d (full tension below NA)
            Convention: positive strain to the right (tension), negative to the left (compression).
            BUT for visual clarity: draw 0.003 to the LEFT of axis (compression block), εt to the RIGHT.   */}

        {(() => {
          const epsCu = 0.003;
          const epsT = result.flexure.epsT;
          // Scale: 0.003 → strainMaxOff
          const compOff = strainMaxOff;
          const tensOff = Math.min(strainMaxOff * 1.4, (epsT / epsCu) * strainMaxOff);

          return (
            <>
              {/* Compression triangle (above NA, to the left of axis) */}
              <polygon
                points={`
                  ${strainAxisX},${sectionTop}
                  ${strainAxisX - compOff},${sectionTop}
                  ${strainAxisX},${yNA}
                `}
                fill="rgba(255, 138, 114, 0.25)" stroke="#e2766b" strokeWidth="1" />

              {/* Tension triangle (below NA, to the right of axis) */}
              <polygon
                points={`
                  ${strainAxisX},${yNA}
                  ${strainAxisX + tensOff},${yTens}
                  ${strainAxisX},${yTens}
                `}
                fill="rgba(95, 182, 116, 0.25)" stroke="#5fb674" strokeWidth="1" />

              {/* εcu = 0.003 label + tick at top compression edge */}
              <line x1={strainAxisX - compOff} y1={sectionTop - 4}
                    x2={strainAxisX - compOff} y2={sectionTop + 4}
                    stroke="#e2766b" strokeWidth="1.2" />
              <text x={strainAxisX - compOff - 8} y={sectionTop - 6} textAnchor="end"
                    fontSize="11" fontWeight="700" fill="#ff8a72">
                {`εcu = ${epsCu.toFixed(3)}`}
              </text>

              {/* εt label + tick at tension steel level */}
              <line x1={strainAxisX + tensOff} y1={yTens - 4}
                    x2={strainAxisX + tensOff} y2={yTens + 4}
                    stroke="#5fb674" strokeWidth="1.2" />
              <text x={strainAxisX + tensOff + 8} y={yTens + 4} textAnchor="start"
                    fontSize="11" fontWeight="700" fill="#5fb674">
                {`εt = ${(epsT * 1000).toFixed(2)}‰`}
              </text>

              {/* εty (yield strain) reference dotted line */}
              {(() => {
                const epsTy = result.flexure.epsTy;
                if (epsTy <= 0 || epsTy > epsT) return null;
                const yYield = yNA + ((epsTy / epsCu) * cPx);
                const yieldOff = Math.min(strainMaxOff * 1.4, (epsTy / epsCu) * strainMaxOff);
                if (yYield > yTens) return null;
                return (
                  <g>
                    <line x1={strainAxisX} y1={yYield}
                          x2={strainAxisX + yieldOff} y2={yYield}
                          stroke="#c9a84c" strokeWidth="0.5" strokeDasharray="3 2" />
                    <text x={strainAxisX + yieldOff + 4} y={yYield + 3}
                          fontSize="8" fontStyle="italic" fill="#c9a84c">
                      {`εty = ${(epsTy * 1000).toFixed(2)}‰`}
                    </text>
                  </g>
                );
              })()}
            </>
          );
        })()}

        {/* "(compression)" / "(tension)" small italic legends — sit ~22 px above
             the strain triangle apex, below the title row, so they don't crowd
             either the bold STRAIN DIAGRAM title nor the εcu = 0.003 callout. */}
        <text x={strainAxisX - strainMaxOff / 2} y={sectionTop - 24} textAnchor="middle"
              fontSize="8.5" fill="#ff8a72" fontStyle="italic">
          ← compression
        </text>
        <text x={strainAxisX + strainMaxOff / 2 + 20} y={sectionBot + 24} textAnchor="middle"
              fontSize="8.5" fill="#5fb674" fontStyle="italic">
          tension →
        </text>

        {/* Section classification badge */}
        <g transform={`translate(${strainX + strainW / 2}, ${sectionBot + 42})`}>
          <rect x={-90} y={-12} width="180" height="22" rx="11"
                fill={result.flexure.section === 'tension-controlled' ? 'rgba(95,182,116,0.18)'
                      : result.flexure.section === 'transition' ? 'rgba(201,168,76,0.18)'
                      : 'rgba(255,138,114,0.15)'}
                stroke={result.flexure.section === 'tension-controlled' ? '#5fb674'
                        : result.flexure.section === 'transition' ? '#c9a84c'
                        : '#ff8a72'}
                strokeWidth="0.6" />
          <text x="0" y="3" textAnchor="middle" fontSize="9.5" fontWeight="700"
                fill={result.flexure.section === 'tension-controlled' ? '#6fd58a'
                      : result.flexure.section === 'transition' ? '#e0bf5e'
                      : '#ff8a72'}>
            {result.flexure.section.replace('-', ' ')} · φ = {result.flexure.phi.toFixed(3)}
          </text>
        </g>
      </g>

      {/* ═══════════════════ PANE 3 — WHITNEY STRESS BLOCK ═══════════════════ */}
      <g>
        <text x={stressX + 170} y={padY - 50} textAnchor="middle" fontSize="13" fontWeight="700" fill="rgba(255,255,255,0.92)">
          WHITNEY STRESS BLOCK
        </text>

        {/* Vertical reference axis at right side */}
        <line x1={stressLeft - 8} y1={sectionTop} x2={stressLeft - 8} y2={sectionBot}
              stroke="rgba(255,255,255,0.55)" strokeWidth="1" />

        {/* Compressive stress block: solid 0.85·f'c rectangle from top to depth a */}
        <rect x={stressLeft} y={sectionTop} width={stressBlockW} height={aPx}
              fill="rgba(226, 118, 107, 0.45)" stroke="#e2766b" strokeWidth="1" />

        {/* Stress arrows inside the block (multiple, showing uniform distribution) */}
        {Array.from({ length: 5 }).map((_, i) => {
          const yArrow = sectionTop + aPx * (i + 0.5) / 5;
          return (
            <line key={i}
              x1={stressRight} y1={yArrow}
              x2={stressLeft + 8} y2={yArrow}
              stroke="#e2766b" strokeWidth="1.2" markerEnd="url(#force-c)" />
          );
        })}

        {/* Top dimension: 0.85·f'c label with extension arrows */}
        <DimLineH y={sectionTop - 12} x1={stressLeft} x2={stressRight}
                  label={`0.85·fʹc = ${fmt(0.85 * input.materials.fc, 2)} MPa`}
                  color="#e2766b" />

        {/* a (depth) dimension on the right side (text RIGHT of line) */}
        <DimLineV x={stressRight + 28} y1={sectionTop} y2={sectionTop + aPx}
                  label={`a = β₁·c = ${fmt(result.flexure.a)} mm`}
                  color="#e2766b" textOffset={14} />

        {/* a/2 lever-arm marker — small caret on LEFT side of the stress block,
            with text further LEFT (outside the block) so it never sits on top of
            the 0.85·f'c top dim line or the C-force arrows. */}
        {(() => {
          const yC = sectionTop + aPx / 2;
          // Put text well outside the stress-block left edge to keep clear
          // both of the inside arrows and of the top 0.85·f'c dim text.
          const tickL = stressLeft - 22;
          const tickR = stressLeft - 2;
          return (
            <g>
              <line x1={tickL} y1={yC} x2={tickR} y2={yC}
                    stroke="#e2766b" strokeWidth="0.7" strokeDasharray="2 2" />
              <text x={tickL - 4} y={yC + 3} textAnchor="end"
                    fontSize="9" fontStyle="italic" fontWeight="600" fill="#ff8a72">
                a/2
              </text>
            </g>
          );
        })()}

        {/* C force arrow (compression resultant) */}
        {(() => {
          const yC = sectionTop + aPx / 2;
          // Effective compression width: bf for T/L-beam, bw for rectangular and inverted-T
          const bEffC = (g.shape === 'T-beam' || g.shape === 'L-beam') ? (g.bf ?? g.bw) : g.bw;
          const C_force = (0.85 * input.materials.fc * result.flexure.a * bEffC) / 1000;
          return (
            <g>
              <line x1={stressRight + 88} y1={yC}
                    x2={stressRight + 60} y2={yC}
                    stroke="#e2766b" strokeWidth="2" markerEnd="url(#force-c)" />
              <text x={stressRight + 92} y={yC - 4}
                    fontSize="11" fontWeight="700" fill="#ff8a72">
                {`C = ${fmt(C_force)} kN`}
              </text>
              <text x={stressRight + 92} y={yC + 10}
                    fontSize="8" fontStyle="italic" fill="#ff8a72">
                C = 0.85·fʹc·a·b
              </text>
            </g>
          );
        })()}

        {/* T force arrow (tension resultant) at d level */}
        {(() => {
          const T_force = (result.flexure.As * input.materials.fy) / 1000;
          return (
            <g>
              <line x1={stressLeft + 60} y1={yTens}
                    x2={stressLeft + 88} y2={yTens}
                    stroke="#5fb674" strokeWidth="2" markerEnd="url(#force-t)" />
              <text x={stressLeft + 92} y={yTens - 4}
                    fontSize="11" fontWeight="700" fill="#5fb674">
                {`T = ${fmt(T_force)} kN`}
              </text>
              <text x={stressLeft + 92} y={yTens + 10}
                    fontSize="8" fontStyle="italic" fill="#5fb674">
                T = As·fy
              </text>
            </g>
          );
        })()}

        {/* Lever arm jd = d - a/2 dimension */}
        {(() => {
          const yC = sectionTop + aPx / 2;
          const jd = g.d - result.flexure.a / 2;
          return (
            <DimLineV x={stressLeft - 32} y1={yC} y2={yTens}
                      label={`jd = d − a/2 = ${fmt(jd)} mm`}
                      color="#76b6c9" textOffset={-14} />
          );
        })()}
      </g>

      {/* ═════════════════ FOOTER: Mn / φMn summary ═════════════════ */}
      <g>
        <line x1={padX} y1={H - 60} x2={W - padX} y2={H - 60}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <text x={padX} y={H - 38} fontSize="13" fontWeight="700" fill="rgba(255,255,255,0.92)">
          {`Mn = T · jd = ${fmt(result.flexure.Mn)} kN·m`}
        </text>
        <text x={W / 2} y={H - 38} textAnchor="middle" fontSize="13" fontWeight="700" fill="rgba(255,255,255,0.92)">
          {`φMn = ${fmt(result.flexure.phiMn)} kN·m  (φ = ${result.flexure.phi.toFixed(3)})`}
        </text>
        <text x={padX} y={H - 18} fontSize="10" fill="rgba(255,255,255,0.6)" fontStyle="italic">
          β₁ = {result.flexure.beta1.toFixed(3)} · εt = {(result.flexure.epsT * 1000).toFixed(2)}‰ · εty = {(result.flexure.epsTy * 1000).toFixed(2)}‰ · Section: {result.flexure.section.replace('-', ' ')}
        </text>
      </g>
    </svg>
  );
}

// ============================================================================
// Helper components — drafting-style horizontal/vertical dimension lines
// ============================================================================

function DimLineH({ y, x1, x2, label, color = '#cbd5e1', textOffset = 0 }: {
  y: number; x1: number; x2: number; label: string;
  color?: string; textOffset?: number;
}) {
  const ext = 6;
  return (
    <g>
      {/* Extension lines */}
      <line x1={x1} y1={y - ext} x2={x1} y2={y + ext} stroke={color} strokeWidth="0.5" />
      <line x1={x2} y1={y - ext} x2={x2} y2={y + ext} stroke={color} strokeWidth="0.5" />
      {/* Dim line with arrows on both sides */}
      <line x1={x1 + 1} y1={y} x2={x2 - 1} y2={y}
            stroke={color} strokeWidth="0.7"
            markerStart="url(#dim-arrow-start)" markerEnd="url(#dim-arrow-end)" />
      {/* Label centered above */}
      <text x={(x1 + x2) / 2} y={y - 5 + textOffset} textAnchor="middle"
            fontSize="10" fontWeight="600" fill={color}>
        {label}
      </text>
    </g>
  );
}

function DimLineV({ x, y1, y2, label, color = '#cbd5e1', textOffset = -14 }: {
  x: number; y1: number; y2: number; label: string;
  color?: string;
  /** Distance from dim line to TEXT center (perpendicular).
   *  Negative → text on the LEFT of line; positive → text on the RIGHT.
   *  |textOffset| should be ≥ 12 so the rotated text bbox doesn't overlap
   *  the dim line itself. */
  textOffset?: number;
}) {
  const ext = 6;
  const textX = x + textOffset;
  return (
    <g>
      {/* Extension ticks */}
      <line x1={x - ext} y1={y1} x2={x + ext} y2={y1} stroke={color} strokeWidth="0.5" />
      <line x1={x - ext} y1={y2} x2={x + ext} y2={y2} stroke={color} strokeWidth="0.5" />
      {/* Dim line with arrows */}
      <line x1={x} y1={y1 + 1} x2={x} y2={y2 - 1}
            stroke={color} strokeWidth="0.7"
            markerStart="url(#dim-arrow-start)" markerEnd="url(#dim-arrow-end)" />
      {/* Label rotated 90° and offset perpendicular to the dim line */}
      <text x={textX} y={(y1 + y2) / 2} textAnchor="middle"
            fontSize="10" fontWeight="600" fill={color}
            transform={`rotate(-90, ${textX}, ${(y1 + y2) / 2})`}>
        {label}
      </text>
    </g>
  );
}
