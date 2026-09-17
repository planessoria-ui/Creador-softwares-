import React from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Character as CharacterDef, Emotion, Line } from "../../shared/schema";
import { FOODS, shade } from "../foods";

type Props = {
  character: CharacterDef;
  /** 0..1: quant oberta té la boca */
  mouth: number;
  emotion: Emotion;
  /** true mentre és qui parla */
  active: boolean;
  /** frame relatiu a l'inici de la seva línia (o null si no parla) */
  lineFrame: number | null;
  action: Line["action"];
  /** mida en píxels del costat del personatge */
  size: number;
  /** 1 = mira a la dreta, -1 = mira a l'esquerra (cap al centre) */
  facing: 1 | -1;
  seed: string;
};

const Face: React.FC<{
  cx: number;
  cy: number;
  scale: number;
  mouth: number;
  emotion: Emotion;
  blink: number; // 0 obert, 1 tancat
  color: string;
  facing: 1 | -1;
  accessory: CharacterDef["accessory"];
}> = ({ cx, cy, scale: s, mouth, emotion, blink, color, facing, accessory }) => {
  const eyeDx = 20 * s;
  const eyeDy = -10 * s;
  const eyeR = 13 * s;
  const pupilR = emotion === "scared" ? 4 * s : emotion === "surprised" ? 7 * s : 6 * s;
  const pupilShift = facing * 3 * s;
  const lidClose =
    emotion === "smug" ? 0.45 : emotion === "angry" ? 0.25 : emotion === "sad" ? 0.2 : 0;
  const close = Math.max(blink, lidClose);
  const dark = shade(color, -0.55);

  const mouthY = cy + 22 * s;
  const mouthW = (emotion === "surprised" ? 20 : 28) * s;
  const open = 3 * s + mouth * 22 * s;

  const browY = cy - 28 * s;
  const browLen = 16 * s;
  const brow = (side: -1 | 1) => {
    const x = cx + side * eyeDx;
    let rot = 0;
    let dy = 0;
    if (emotion === "angry") rot = side * 22;
    else if (emotion === "sad") rot = -side * 20;
    else if (emotion === "surprised" || emotion === "scared") dy = -6 * s;
    else if (emotion === "confused") { rot = side === 1 ? -18 : 0; dy = side === 1 ? -7 * s : 0; }
    else if (emotion === "smug") { rot = side === 1 ? 12 : -4; }
    return (
      <line
        key={side}
        x1={x - browLen / 2}
        y1={browY + dy}
        x2={x + browLen / 2}
        y2={browY + dy}
        stroke={dark}
        strokeWidth={4.5 * s}
        strokeLinecap="round"
        transform={`rotate(${rot} ${x} ${browY + dy})`}
      />
    );
  };

  const eye = (side: -1 | 1) => {
    const x = cx + side * eyeDx;
    const y = cy + eyeDy;
    return (
      <g key={side}>
        <ellipse cx={x} cy={y} rx={eyeR} ry={eyeR * (1 - close * 0.92)} fill="#fff" stroke={dark} strokeWidth={2.5 * s} />
        {close < 0.9 && (
          <>
            <circle cx={x + pupilShift} cy={y + 1.5 * s} r={pupilR * (1 - close * 0.6)} fill="#1a1a1a" />
            <circle cx={x + pupilShift + 2.5 * s} cy={y - 2 * s} r={2 * s} fill="#fff" />
          </>
        )}
      </g>
    );
  };

  const renderMouth = () => {
    if (mouth > 0.12 || emotion === "surprised" || emotion === "scared") {
      // boca oberta: el·lipse amb dents i llengua
      const h = emotion === "surprised" || emotion === "scared" ? Math.max(open, 14 * s) : open;
      return (
        <g>
          <ellipse cx={cx} cy={mouthY + h / 2} rx={mouthW / 2} ry={h / 2} fill="#7b1f2b" stroke={dark} strokeWidth={2.5 * s} />
          {h > 10 * s && (
            <>
              <rect x={cx - mouthW / 2 + 3 * s} y={mouthY + 1} width={mouthW - 6 * s} height={Math.min(6 * s, h / 3)} rx={2 * s} fill="#fff" />
              <ellipse cx={cx} cy={mouthY + h} rx={mouthW / 3} ry={Math.min(6 * s, h / 3)} fill="#e57373" />
            </>
          )}
        </g>
      );
    }
    // boca tancada: forma segons emoció
    if (emotion === "happy" || emotion === "smug") {
      const w = emotion === "smug" ? mouthW * 0.8 : mouthW;
      const dx = emotion === "smug" ? facing * 6 * s : 0;
      return (
        <path
          d={`M${cx - w / 2 + dx} ${mouthY - 2 * s} Q ${cx + dx} ${mouthY + 14 * s}, ${cx + w / 2 + dx} ${mouthY - (emotion === "smug" ? 8 : 2) * s}`}
          fill="none"
          stroke={dark}
          strokeWidth={4 * s}
          strokeLinecap="round"
        />
      );
    }
    if (emotion === "sad") {
      return (
        <path d={`M${cx - mouthW / 2} ${mouthY + 8 * s} Q ${cx} ${mouthY - 6 * s}, ${cx + mouthW / 2} ${mouthY + 8 * s}`} fill="none" stroke={dark} strokeWidth={4 * s} strokeLinecap="round" />
      );
    }
    if (emotion === "angry") {
      return (
        <path d={`M${cx - mouthW / 2} ${mouthY + 4 * s} L ${cx + mouthW / 2} ${mouthY + 4 * s}`} fill="none" stroke={dark} strokeWidth={5 * s} strokeLinecap="round" />
      );
    }
    if (emotion === "confused") {
      return (
        <path d={`M${cx - mouthW / 2} ${mouthY + 4 * s} Q ${cx - mouthW / 6} ${mouthY - 4 * s}, ${cx} ${mouthY + 4 * s} T ${cx + mouthW / 2} ${mouthY + 4 * s}`} fill="none" stroke={dark} strokeWidth={4 * s} strokeLinecap="round" />
      );
    }
    return (
      <path d={`M${cx - mouthW / 2.5} ${mouthY + 2 * s} Q ${cx} ${mouthY + 8 * s}, ${cx + mouthW / 2.5} ${mouthY + 2 * s}`} fill="none" stroke={dark} strokeWidth={4 * s} strokeLinecap="round" />
    );
  };

  const renderAccessory = () => {
    const y = cy + eyeDy;
    switch (accessory) {
      case "glasses":
        return (
          <g fill="none" stroke="#263238" strokeWidth={3 * s}>
            <circle cx={cx - eyeDx} cy={y} r={eyeR + 4 * s} />
            <circle cx={cx + eyeDx} cy={y} r={eyeR + 4 * s} />
            <line x1={cx - eyeDx + eyeR + 4 * s} y1={y} x2={cx + eyeDx - eyeR - 4 * s} y2={y} />
          </g>
        );
      case "sunglasses":
        return (
          <g>
            <rect x={cx - eyeDx - eyeR - 4 * s} y={y - eyeR - 2 * s} width={(eyeR + 4 * s) * 2} height={eyeR * 1.8} rx={5 * s} fill="#1a1a1a" />
            <rect x={cx + eyeDx - eyeR - 4 * s} y={y - eyeR - 2 * s} width={(eyeR + 4 * s) * 2} height={eyeR * 1.8} rx={5 * s} fill="#1a1a1a" />
            <line x1={cx - eyeDx + eyeR} y1={y - 4 * s} x2={cx + eyeDx - eyeR} y2={y - 4 * s} stroke="#1a1a1a" strokeWidth={3 * s} />
            <rect x={cx - eyeDx - eyeR} y={y - eyeR + 1 * s} width={8 * s} height={4 * s} fill="#fff" opacity={0.5} />
          </g>
        );
      case "hat":
        return (
          <g transform={`translate(0 ${-40 * s})`}>
            <rect x={cx - 42 * s} y={cy + 4 * s} width={84 * s} height={8 * s} rx={4 * s} fill="#37474f" />
            <rect x={cx - 26 * s} y={cy - 32 * s} width={52 * s} height={38 * s} rx={5 * s} fill="#37474f" />
            <rect x={cx - 26 * s} y={cy - 4 * s} width={52 * s} height={7 * s} fill="#ef5350" />
          </g>
        );
      case "bowtie":
        return (
          <g transform={`translate(${cx} ${cy + 48 * s})`}>
            <path d={`M0 0 L ${-18 * s} ${-10 * s} L ${-18 * s} ${10 * s} Z M0 0 L ${18 * s} ${-10 * s} L ${18 * s} ${10 * s} Z`} fill="#e53935" stroke="#8e0000" strokeWidth={2 * s} />
            <circle r={4 * s} fill="#8e0000" />
          </g>
        );
      case "mustache":
        return (
          <path
            d={`M${cx} ${mouthY - 6 * s} C ${cx - 8 * s} ${mouthY - 16 * s}, ${cx - 26 * s} ${mouthY - 10 * s}, ${cx - 24 * s} ${mouthY - 2 * s} C ${cx - 14 * s} ${mouthY - 4 * s}, ${cx - 6 * s} ${mouthY - 2 * s}, ${cx} ${mouthY - 6 * s} C ${cx + 6 * s} ${mouthY - 2 * s}, ${cx + 14 * s} ${mouthY - 4 * s}, ${cx + 24 * s} ${mouthY - 2 * s} C ${cx + 26 * s} ${mouthY - 10 * s}, ${cx + 8 * s} ${mouthY - 16 * s}, ${cx} ${mouthY - 6 * s} Z`}
            fill="#3e2723"
          />
        );
      case "crown":
        return (
          <g transform={`translate(${cx} ${cy - 44 * s})`}>
            <path d={`M${-30 * s} 0 L ${-30 * s} ${-26 * s} L ${-15 * s} ${-12 * s} L 0 ${-32 * s} L ${15 * s} ${-12 * s} L ${30 * s} ${-26 * s} L ${30 * s} 0 Z`} fill="#ffd54f" stroke="#c79100" strokeWidth={2.5 * s} strokeLinejoin="round" />
            <circle cx={0} cy={-6 * s} r={4 * s} fill="#e53935" />
          </g>
        );
      case "headphones":
        return (
          <g fill="none" stroke="#263238" strokeWidth={5 * s}>
            <path d={`M${cx - 44 * s} ${y + 6 * s} C ${cx - 44 * s} ${cy - 50 * s}, ${cx + 44 * s} ${cy - 50 * s}, ${cx + 44 * s} ${y + 6 * s}`} />
            <rect x={cx - 52 * s} y={y - 6 * s} width={14 * s} height={24 * s} rx={5 * s} fill="#ef5350" />
            <rect x={cx + 38 * s} y={y - 6 * s} width={14 * s} height={24 * s} rx={5 * s} fill="#ef5350" />
          </g>
        );
      default:
        return null;
    }
  };

  const cheeks = emotion === "happy" || emotion === "smug" || emotion === "surprised" ? 0.45 : 0.25;

  return (
    <g>
      <circle cx={cx - 34 * s} cy={cy + 12 * s} r={8 * s} fill="#ff8a80" opacity={cheeks} />
      <circle cx={cx + 34 * s} cy={cy + 12 * s} r={8 * s} fill="#ff8a80" opacity={cheeks} />
      {eye(-1)}
      {eye(1)}
      {brow(-1)}
      {brow(1)}
      {renderMouth()}
      {renderAccessory()}
    </g>
  );
};

export const FoodCharacter: React.FC<Props> = ({
  character,
  mouth,
  emotion,
  active,
  lineFrame,
  action,
  size,
  facing,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const def = FOODS[character.kind];

  // Respiració / balanceig suau, desfasat per personatge
  const phase = random(seed) * Math.PI * 2;
  const breathe = Math.sin((frame / fps) * 2.2 + phase);
  const idleScaleY = 1 + breathe * 0.012;
  const idleRot = Math.sin((frame / fps) * 1.3 + phase) * 1.5;

  // Parpelleig determinista cada ~3 s
  const blinkPeriod = Math.round(fps * (2.6 + random(seed + "b") * 1.4));
  const blinkPhase = Math.round(random(seed + "p") * blinkPeriod);
  const inBlink = (frame + blinkPhase) % blinkPeriod;
  const blink = inBlink < 4 ? interpolate(inBlink, [0, 2, 4], [0, 1, 0]) : 0;

  // Bot quan parla: petit rebot rítmic
  const talkBob = active && mouth > 0.1 ? Math.sin(frame * 1.1) * 4 * mouth : 0;

  // Accions puntuals al començar la línia
  let actionTransform = "";
  let eyesShut = 0;
  if (lineFrame !== null && lineFrame >= 0) {
    const t = lineFrame;
    const sp = spring({ frame: t, fps, config: { damping: 8, stiffness: 160, mass: 0.6 } });
    switch (action) {
      case "jump": {
        const up = Math.sin(Math.min(1, t / (fps * 0.55)) * Math.PI) * 70;
        actionTransform = `translateY(${-up}px)`;
        break;
      }
      case "shake": {
        const decay = Math.max(0, 1 - t / (fps * 0.7));
        actionTransform = `translateX(${Math.sin(t * 2.4) * 14 * decay}px)`;
        break;
      }
      case "spin": {
        actionTransform = `rotate(${interpolate(sp, [0, 1], [0, 360])}deg)`;
        break;
      }
      case "lean_in": {
        actionTransform = `rotate(${facing * 8 * sp}deg) scale(${1 + 0.06 * sp})`;
        break;
      }
      case "facepalm": {
        const tilt = Math.sin(Math.min(1, t / (fps * 0.9)) * Math.PI);
        actionTransform = `rotate(${tilt * 14}deg) translateY(${tilt * 10}px)`;
        eyesShut = tilt > 0.3 ? 1 : 0;
        break;
      }
      case "point": {
        actionTransform = `rotate(${facing * 5 * sp}deg)`;
        break;
      }
      default:
        break;
    }
  }

  const activeScale = active ? 1.08 : 0.94;
  const dim = active ? 1 : 0.82;
  const appear = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });

  const bodyColor = character.color;
  const showArmPoint = action === "point" && lineFrame !== null && lineFrame >= 0;

  return (
    <div
      style={{
        width: size,
        height: size,
        transformOrigin: "50% 100%",
        transform: `scale(${appear * activeScale}) ${actionTransform} rotate(${idleRot}deg) scaleY(${idleScaleY}) translateY(${talkBob}px)`,
        filter: `saturate(${dim}) brightness(${active ? 1 : 0.9})`,
        transition: "none",
      }}
    >
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: "visible" }}>
        <defs>
          <filter id={`sh-${character.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>
        <ellipse cx={100} cy={192} rx={70} ry={10} fill="#000" opacity={0.25} />
        <g filter={`url(#sh-${character.id})`} transform={facing === -1 ? "" : "translate(200 0) scale(-1 1)"}>
          {def.body(bodyColor)}
        </g>
        {showArmPoint && (
          <g transform={`translate(${facing === 1 ? 168 : 32} 120)`}>
            <line x1={0} y1={0} x2={facing * 42} y2={-28} stroke={shade(bodyColor, -0.45)} strokeWidth={9} strokeLinecap="round" />
            <circle cx={facing * 46} cy={-31} r={9} fill={bodyColor} stroke={shade(bodyColor, -0.45)} strokeWidth={3} />
          </g>
        )}
        <Face
          cx={def.face.cx}
          cy={def.face.cy}
          scale={def.face.scale}
          mouth={active ? mouth : 0}
          emotion={emotion}
          blink={Math.max(blink, eyesShut)}
          color={bodyColor}
          facing={facing}
          accessory={character.accessory}
        />
        {def.front?.(bodyColor)}
      </svg>
    </div>
  );
};
