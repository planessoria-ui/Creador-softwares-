import React from "react";
import { Img } from "remotion";
import type { Character as CharacterDef, ImageCharacter as ImageCharacterDef, Line } from "../../shared/schema";
import { useCharacterMotion } from "./Character";

type Props = {
  character: CharacterDef;
  /** PNG amb transparència del personatge */
  cutoutUrl: string;
  geometry: ImageCharacterDef;
  /** 0 = l'original de la imatge; 1, 2 = variants (girades, amb canvi de to i accessori) */
  variant: number;
  mouth: number;
  active: boolean;
  lineFrame: number | null;
  action: Line["action"];
  /** alçada en píxels del personatge */
  height: number;
  facing: 1 | -1;
  seed: string;
};

/** Boca superposada, en percentatges de la imatge, que s'obre segons l'àudio. */
const MouthOverlay: React.FC<{ x: number; y: number; w: number; open: number; flipped: boolean }> = ({ x, y, w, open, flipped }) => {
  if (open < 0.06) return null;
  const cx = flipped ? 1 - x : x;
  const h = 0.25 + open * 0.75; // proporció alçada/amplada
  return (
    <div
      style={{
        position: "absolute",
        left: `${cx * 100}%`,
        top: `${y * 100}%`,
        width: `${w * 100}%`,
        transform: "translate(-50%, -45%)",
        pointerEvents: "none",
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <radialGradient id="mouth-inner" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#5a0f1a" />
            <stop offset="100%" stopColor="#2b060c" />
          </radialGradient>
          <filter id="mouth-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
        <g transform={`translate(50 50) scale(1 ${h}) translate(-50 -50)`}>
          <ellipse cx={50} cy={50} rx={48} ry={48} fill="url(#mouth-inner)" filter="url(#mouth-soft)" />
          <ellipse cx={50} cy={50} rx={46} ry={46} fill="none" stroke="#3a0a12" strokeWidth={3} opacity={0.7} />
          {/* dents superiors i llengua */}
          <rect x={14} y={6} width={72} height={16 / Math.max(h, 0.4)} rx={5} fill="#f6f1ea" opacity={0.95} />
          <ellipse cx={50} cy={92} rx={30} ry={18 / Math.max(h, 0.4)} fill="#c94a5a" opacity={0.95} />
        </g>
      </svg>
    </div>
  );
};

/** Accessori dibuixat sobre la cara (en percentatges del requadre de la cara). */
const FaceAccessory: React.FC<{ face: ImageCharacterDef["face"]; kind: CharacterDef["accessory"]; flipped: boolean }> = ({ face, kind, flipped }) => {
  if (kind === "none") return null;
  const fx = flipped ? 1 - face.x - face.w : face.x;
  const box = { position: "absolute" as const, left: `${fx * 100}%`, top: `${face.y * 100}%`, width: `${face.w * 100}%`, height: `${face.h * 100}%`, pointerEvents: "none" as const };
  const svg = (children: React.ReactNode, viewBox = "0 0 100 100") => (
    <div style={box}>
      <svg viewBox={viewBox} width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: "visible" }}>
        {children}
      </svg>
    </div>
  );
  switch (kind) {
    case "sunglasses":
      return svg(
        <g>
          <rect x={8} y={30} width={36} height={18} rx={6} fill="#111" opacity={0.95} />
          <rect x={56} y={30} width={36} height={18} rx={6} fill="#111" opacity={0.95} />
          <rect x={44} y={36} width={12} height={4} fill="#111" />
          <rect x={12} y={33} width={10} height={4} fill="#fff" opacity={0.4} />
        </g>
      );
    case "glasses":
      return svg(
        <g fill="none" stroke="#222" strokeWidth={3}>
          <ellipse cx={27} cy={40} rx={18} ry={11} />
          <ellipse cx={73} cy={40} rx={18} ry={11} />
          <line x1={45} y1={40} x2={55} y2={40} />
        </g>
      );
    case "hat":
      return svg(
        <g transform="translate(0 -38)">
          <rect x={-5} y={30} width={110} height={8} rx={4} fill="#2f3a45" />
          <rect x={15} y={0} width={70} height={32} rx={5} fill="#2f3a45" />
          <rect x={15} y={24} width={70} height={7} fill="#e53935" />
        </g>
      );
    case "crown":
      return svg(
        <g transform="translate(0 -34)">
          <path d="M12 34 L 12 6 L 32 20 L 50 0 L 68 20 L 88 6 L 88 34 Z" fill="#ffd54f" stroke="#c79100" strokeWidth={2.5} strokeLinejoin="round" />
          <circle cx={50} cy={24} r={4} fill="#e53935" />
        </g>
      );
    case "mustache":
      return svg(
        <path d="M50 66 C 44 56, 26 60, 24 70 C 34 68, 44 70, 50 66 C 56 70, 66 68, 76 70 C 74 60, 56 56, 50 66 Z" fill="#3e2723" />
      );
    case "bowtie":
      return svg(
        <g transform="translate(0 4)">
          <path d="M50 108 L 30 98 L 30 118 Z M50 108 L 70 98 L 70 118 Z" fill="#e53935" stroke="#8e0000" strokeWidth={2} />
          <circle cx={50} cy={108} r={4} fill="#8e0000" />
        </g>
      );
    case "headphones":
      return svg(
        <g fill="none" stroke="#263238" strokeWidth={5}>
          <path d="M6 45 C 6 -5, 94 -5, 94 45" />
          <rect x={-2} y={38} width={14} height={26} rx={5} fill="#ef5350" />
          <rect x={88} y={38} width={14} height={26} rx={5} fill="#ef5350" />
        </g>
      );
    default:
      return null;
  }
};

/** Personatge retallat de la imatge de l'usuari, animat, amb boca sincronitzada i variants. */
export const ImageCharacter: React.FC<Props> = ({
  character,
  cutoutUrl,
  geometry,
  variant,
  mouth,
  active,
  lineFrame,
  action,
  height,
  facing,
  seed,
}) => {
  const motion = useCharacterMotion({ active, mouth, lineFrame, action, facing, seed });
  // L'original mira cap a on el posem; les variants es giren i canvien lleugerament de to.
  const flipped = variant % 2 === 1;
  const hue = variant === 0 ? 0 : variant === 1 ? 28 : -32;
  const variantFilter = variant === 0 ? "" : ` hue-rotate(${hue}deg) saturate(${variant === 1 ? 1.15 : 0.9}) brightness(${variant === 1 ? 1.04 : 0.96})`;

  return (
    <div
      style={{
        height,
        transformOrigin: "50% 100%",
        transform: motion.transform,
        filter: motion.filter + variantFilter,
        position: "relative",
        display: "inline-block",
      }}
    >
      <div style={{ position: "relative", height, display: "inline-block" }}>
        <Img
          src={cutoutUrl}
          style={{
            height,
            width: "auto",
            display: "block",
            transform: flipped ? "scaleX(-1)" : undefined,
            filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.45))",
          }}
        />
        <FaceAccessory face={geometry.face} kind={character.accessory} flipped={flipped} />
        <MouthOverlay x={geometry.mouth.x} y={geometry.mouth.y} w={Math.max(0.04, geometry.mouth.w)} open={active ? mouth : 0} flipped={flipped} />
      </div>
    </div>
  );
};
