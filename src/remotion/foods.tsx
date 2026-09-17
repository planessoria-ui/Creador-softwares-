import React from "react";
import type { FoodKind } from "../shared/schema";

/** Utilitats de color ------------------------------------------------------ */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function shade(hex: string, amount: number): string {
  // amount > 0 aclareix, < 0 enfosqueix
  const [r, g, b] = hexToRgb(hex);
  const t = amount > 0 ? 255 : 0;
  const p = Math.abs(amount);
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}

/**
 * Cada menjar es dibuixa dins d'un viewBox de 200x200, amb el terra a y=190.
 * `face` indica on va la cara (centre) i a quina escala.
 */
export type FoodDef = {
  body: (c: string) => React.ReactNode;
  face: { cx: number; cy: number; scale: number };
  /** Elements que van per sobre de la cara (p. ex. la tija d'una poma no cal, però una fulla davant sí) */
  front?: (c: string) => React.ReactNode;
};

const leaf = (x: number, y: number, rot = 0, color = "#5cb85c") => (
  <path
    d="M0 0 C 14 -22, 42 -22, 44 0 C 30 12, 10 12, 0 0 Z"
    fill={color}
    stroke={shade(color, -0.3)}
    strokeWidth={2.5}
    transform={`translate(${x} ${y}) rotate(${rot})`}
  />
);

const stem = (x: number, y: number, h = 22, color = "#6d4c41") => (
  <path
    d={`M${x} ${y} C ${x - 2} ${y - h * 0.5}, ${x + 4} ${y - h * 0.8}, ${x + 3} ${y - h}`}
    fill="none"
    stroke={color}
    strokeWidth={7}
    strokeLinecap="round"
  />
);

const shine = (cx: number, cy: number, rx = 12, ry = 20, rot = -25) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" opacity={0.28} transform={`rotate(${rot} ${cx} ${cy})`} />
);

const outline = (c: string) => ({ stroke: shade(c, -0.45), strokeWidth: 4, strokeLinejoin: "round" as const });

export const FOODS: Record<FoodKind, FoodDef> = {
  apple: {
    body: (c) => (
      <g>
        {stem(100, 52)}
        {leaf(102, 44, -30)}
        <path
          d="M100 60 C 70 30, 20 50, 25 105 C 28 150, 60 190, 100 185 C 140 190, 172 150, 175 105 C 180 50, 130 30, 100 60 Z"
          fill={c}
          {...outline(c)}
        />
        {shine(60, 95)}
      </g>
    ),
    face: { cx: 100, cy: 115, scale: 1 },
  },
  banana: {
    body: (c) => (
      <g>
        <path
          d="M40 40 C 20 90, 40 170, 110 185 C 150 192, 180 170, 185 150 C 150 165, 90 150, 65 90 C 55 65, 55 50, 40 40 Z"
          fill={c}
          {...outline(c)}
        />
        <path d="M38 34 l 8 -14 l 8 12 Z" fill="#6d4c41" />
        <path d="M180 148 l 12 4 l -8 8 Z" fill="#6d4c41" />
        {shine(70, 120, 8, 26, -50)}
      </g>
    ),
    face: { cx: 118, cy: 150, scale: 0.85 },
  },
  tomato: {
    body: (c) => (
      <g>
        <ellipse cx={100} cy={118} rx={80} ry={70} fill={c} {...outline(c)} />
        {shine(58, 95)}
        <path d="M100 48 l -6 -18 l 12 0 Z" fill="#4caf50" />
        <path d="M100 55 l -30 -12 l 14 18 Z M100 55 l 30 -12 l -14 18 Z M100 55 l -14 -26 l 14 12 Z M100 55 l 14 -26 l -14 12 Z" fill="#66bb6a" stroke="#2e7d32" strokeWidth={2} />
      </g>
    ),
    face: { cx: 100, cy: 120, scale: 1 },
  },
  carrot: {
    body: (c) => (
      <g>
        <path d="M100 40 l -22 -34 l 14 30 l -2 -38 l 12 36 l 10 -34 l -2 36 l 22 -26 Z" fill="#43a047" stroke="#2e7d32" strokeWidth={2} />
        <path d="M60 45 C 40 100, 70 170, 100 190 C 130 170, 160 100, 140 45 C 120 30, 80 30, 60 45 Z" fill={c} {...outline(c)} />
        <path d="M70 90 h 22 M64 120 h 18 M126 105 h 18 M118 145 h 14" stroke={shade(c, -0.25)} strokeWidth={3} strokeLinecap="round" />
      </g>
    ),
    face: { cx: 100, cy: 100, scale: 0.9 },
  },
  broccoli: {
    body: (c) => (
      <g>
        <rect x={84} y={120} width={32} height={70} rx={12} fill="#a5d6a7" stroke="#2e7d32" strokeWidth={4} />
        <circle cx={60} cy={95} r={34} fill={c} {...outline(c)} />
        <circle cx={140} cy={95} r={34} fill={c} {...outline(c)} />
        <circle cx={100} cy={60} r={38} fill={c} {...outline(c)} />
        <circle cx={100} cy={100} r={40} fill={c} {...outline(c)} />
        <circle cx={72} cy={62} r={10} fill={shade(c, 0.2)} />
        <circle cx={132} cy={66} r={8} fill={shade(c, 0.2)} />
      </g>
    ),
    face: { cx: 100, cy: 100, scale: 0.9 },
  },
  avocado: {
    body: (c) => (
      <g>
        <path d="M100 25 C 60 25, 45 70, 45 100 C 45 150, 65 190, 100 190 C 135 190, 155 150, 155 100 C 155 70, 140 25, 100 25 Z" fill={shade(c, -0.35)} {...outline(c)} />
        <path d="M100 42 C 70 42, 58 80, 58 105 C 58 145, 74 178, 100 178 C 126 178, 142 145, 142 105 C 142 80, 130 42, 100 42 Z" fill={shade(c, 0.35)} />
        <circle cx={100} cy={140} r={26} fill="#8d6e63" stroke="#5d4037" strokeWidth={3} />
        {shine(90, 132, 6, 9)}
      </g>
    ),
    face: { cx: 100, cy: 85, scale: 0.8 },
  },
  lemon: {
    body: (c) => (
      <g>
        <path d="M30 110 C 30 60, 70 45, 100 45 C 130 45, 170 60, 170 110 C 170 160, 130 175, 100 175 C 70 175, 30 160, 30 110 Z" fill={c} {...outline(c)} />
        <ellipse cx={30} cy={110} rx={10} ry={8} fill={c} {...outline(c)} />
        <ellipse cx={170} cy={110} rx={10} ry={8} fill={c} {...outline(c)} />
        {shine(65, 85)}
      </g>
    ),
    face: { cx: 100, cy: 112, scale: 0.95 },
  },
  strawberry: {
    body: (c) => (
      <g>
        <path d="M100 55 C 50 55, 30 90, 40 125 C 50 160, 80 190, 100 190 C 120 190, 150 160, 160 125 C 170 90, 150 55, 100 55 Z" fill={c} {...outline(c)} />
        {[[70, 100], [95, 90], [125, 105], [80, 140], [115, 150], [140, 135], [65, 165]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={4} ry={6} fill="#fff59d" opacity={0.85} />
        ))}
        <path d="M100 60 l -40 -14 l 26 18 M100 60 l 40 -14 l -26 18 M100 60 l -12 -30 l 12 20 M100 60 l 12 -30 l -12 20" fill="#66bb6a" stroke="#2e7d32" strokeWidth={3} strokeLinejoin="round" />
      </g>
    ),
    face: { cx: 100, cy: 120, scale: 0.9 },
  },
  pepper: {
    body: (c) => (
      <g>
        {stem(100, 50, 26, "#558b2f")}
        <path d="M60 55 C 30 55, 30 100, 38 140 C 45 175, 70 190, 80 185 C 90 190, 110 190, 120 185 C 130 190, 155 175, 162 140 C 170 100, 170 55, 140 55 C 120 45, 80 45, 60 55 Z" fill={c} {...outline(c)} />
        <path d="M80 60 C 78 100, 82 150, 80 185 M120 60 C 122 100, 118 150, 120 185" stroke={shade(c, -0.2)} strokeWidth={3} fill="none" />
        {shine(58, 100)}
      </g>
    ),
    face: { cx: 100, cy: 118, scale: 1 },
  },
  orange: {
    body: (c) => (
      <g>
        <circle cx={100} cy={112} r={76} fill={c} {...outline(c)} />
        {leaf(100, 40, -20)}
        <circle cx={100} cy={40} r={5} fill="#6d4c41" />
        {shine(60, 90)}
      </g>
    ),
    face: { cx: 100, cy: 116, scale: 1 },
  },
  pizza: {
    body: (c) => (
      <g>
        <path d="M100 190 L 25 45 C 70 20, 130 20, 175 45 Z" fill="#f9c74f" stroke="#c77b1c" strokeWidth={4} strokeLinejoin="round" />
        <path d="M25 45 C 70 20, 130 20, 175 45 L 168 60 C 130 38, 70 38, 32 60 Z" fill="#e0a341" stroke="#c77b1c" strokeWidth={3} />
        <circle cx={80} cy={80} r={11} fill={c} stroke={shade(c, -0.4)} strokeWidth={2} />
        <circle cx={125} cy={95} r={11} fill={c} stroke={shade(c, -0.4)} strokeWidth={2} />
        <circle cx={100} cy={150} r={10} fill={c} stroke={shade(c, -0.4)} strokeWidth={2} />
      </g>
    ),
    face: { cx: 100, cy: 110, scale: 0.75 },
  },
  egg: {
    body: (c) => (
      <g>
        <path d="M40 140 C 30 90, 60 40, 110 50 C 160 60, 185 110, 165 150 C 145 195, 55 195, 40 140 Z" fill="#fafafa" stroke="#bdbdbd" strokeWidth={4} />
        <circle cx={100} cy={120} r={34} fill={c} {...outline(c)} />
        {shine(88, 108, 5, 8)}
      </g>
    ),
    face: { cx: 100, cy: 122, scale: 0.6 },
  },
  bread: {
    body: (c) => (
      <g>
        <path d="M30 100 C 30 50, 70 40, 100 40 C 130 40, 170 50, 170 100 L 170 175 C 170 185, 160 190, 150 190 L 50 190 C 40 190, 30 185, 30 175 Z" fill={c} {...outline(c)} />
        <path d="M45 100 C 45 65, 75 55, 100 55 C 125 55, 155 65, 155 100 L 155 178 L 45 178 Z" fill={shade(c, 0.45)} />
      </g>
    ),
    face: { cx: 100, cy: 118, scale: 0.95 },
  },
  cheese: {
    body: (c) => (
      <g>
        <path d="M25 170 L 25 105 L 175 65 L 175 170 Z" fill={c} {...outline(c)} />
        <path d="M25 105 L 175 65 L 175 80 L 25 118 Z" fill={shade(c, 0.35)} />
        <circle cx={60} cy={150} r={10} fill={shade(c, -0.2)} />
        <circle cx={110} cy={130} r={7} fill={shade(c, -0.2)} />
        <circle cx={150} cy={150} r={12} fill={shade(c, -0.2)} />
      </g>
    ),
    face: { cx: 100, cy: 118, scale: 0.75 },
  },
  watermelon: {
    body: (c) => (
      <g>
        <path d="M20 70 L 180 70 C 180 140, 150 190, 100 190 C 50 190, 20 140, 20 70 Z" fill="#2e7d32" />
        <path d="M32 78 L 168 78 C 168 135, 142 178, 100 178 C 58 178, 32 135, 32 78 Z" fill="#c8e6c9" />
        <path d="M42 84 L 158 84 C 158 130, 136 168, 100 168 C 64 168, 42 130, 42 84 Z" fill={c} />
        {[[70, 110], [100, 125], [130, 110], [85, 145], [115, 145]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={4} ry={6} fill="#263238" />
        ))}
      </g>
    ),
    face: { cx: 100, cy: 112, scale: 0.75 },
  },
  eggplant: {
    body: (c) => (
      <g>
        <path d="M110 30 C 80 30, 60 60, 55 110 C 50 160, 75 190, 105 190 C 150 190, 175 150, 165 100 C 155 55, 140 30, 110 30 Z" fill={c} {...outline(c)} />
        <path d="M100 42 l -22 -16 l 24 6 l 6 -22 l 8 22 l 24 -6 l -20 18 Z" fill="#66bb6a" stroke="#2e7d32" strokeWidth={3} strokeLinejoin="round" />
        {shine(78, 100)}
      </g>
    ),
    face: { cx: 108, cy: 125, scale: 0.9 },
  },
  potato: {
    body: (c) => (
      <g>
        <path d="M40 90 C 40 50, 90 35, 130 50 C 170 65, 175 120, 160 160 C 145 195, 70 195, 45 160 C 30 140, 40 120, 40 90 Z" fill={c} {...outline(c)} />
        <ellipse cx={60} cy={80} rx={5} ry={4} fill={shade(c, -0.3)} />
        <ellipse cx={150} cy={140} rx={5} ry={4} fill={shade(c, -0.3)} />
        <ellipse cx={70} cy={165} rx={4} ry={3} fill={shade(c, -0.3)} />
      </g>
    ),
    face: { cx: 100, cy: 115, scale: 0.95 },
  },
  mushroom: {
    body: (c) => (
      <g>
        <path d="M65 110 L 65 180 C 65 190, 135 190, 135 180 L 135 110 Z" fill="#fff3e0" stroke="#bcaaa4" strokeWidth={4} />
        <path d="M20 105 C 20 40, 180 40, 180 105 C 180 118, 20 118, 20 105 Z" fill={c} {...outline(c)} />
        <circle cx={60} cy={75} r={11} fill="#fff" opacity={0.9} />
        <circle cx={120} cy={62} r={14} fill="#fff" opacity={0.9} />
        <circle cx={155} cy={90} r={8} fill="#fff" opacity={0.9} />
      </g>
    ),
    face: { cx: 100, cy: 145, scale: 0.6 },
  },
  croissant: {
    body: (c) => (
      <g>
        <path d="M30 150 C 20 100, 60 40, 100 40 C 140 40, 180 100, 170 150 C 165 165, 150 160, 145 150 C 140 110, 120 80, 100 80 C 80 80, 60 110, 55 150 C 50 160, 35 165, 30 150 Z" fill={c} {...outline(c)} />
        <path d="M100 40 C 120 60, 130 120, 130 175 M100 40 C 80 60, 70 120, 70 175" stroke={shade(c, -0.25)} strokeWidth={3} fill="none" />
        <ellipse cx={100} cy={140} rx={45} ry={45} fill={c} {...outline(c)} />
      </g>
    ),
    face: { cx: 100, cy: 140, scale: 0.75 },
  },
  donut: {
    body: (c) => (
      <g>
        <circle cx={100} cy={115} r={78} fill="#e8b27a" stroke="#a9744d" strokeWidth={4} />
        <path d="M30 105 C 30 60, 70 45, 100 48 C 140 45, 175 70, 170 115 C 160 130, 150 118, 145 125 C 130 140, 120 120, 110 128 C 95 140, 85 118, 70 125 C 55 135, 40 125, 30 105 Z" fill={c} {...outline(c)} />
        {[[60, 80, 30], [90, 70, -20], [125, 75, 50], [150, 100, 10], [75, 105, -40]].map(([x, y, r], i) => (
          <rect key={i} x={x} y={y} width={12} height={4} rx={2} fill={["#fff176", "#80deea", "#f48fb1", "#a5d6a7", "#fff"][i]} transform={`rotate(${r} ${x} ${y})`} />
        ))}
        <circle cx={100} cy={118} r={22} fill="#1b1b1b" opacity={0.35} />
      </g>
    ),
    face: { cx: 100, cy: 150, scale: 0.55 },
  },
  grape: {
    body: (c) => (
      <g>
        {stem(100, 45, 25)}
        {leaf(100, 40, -35)}
        {[[70, 70], [130, 70], [50, 105], [100, 100], [150, 105], [70, 140], [130, 140], [100, 172]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={30} fill={c} {...outline(c)} />
        ))}
        {shine(58, 96, 6, 10)}
      </g>
    ),
    face: { cx: 100, cy: 120, scale: 0.85 },
  },
  pear: {
    body: (c) => (
      <g>
        {stem(100, 40, 22)}
        {leaf(102, 34, -25)}
        <path d="M100 40 C 80 40, 72 70, 70 95 C 40 120, 35 190, 100 190 C 165 190, 160 120, 130 95 C 128 70, 120 40, 100 40 Z" fill={c} {...outline(c)} />
        {shine(70, 130)}
      </g>
    ),
    face: { cx: 100, cy: 130, scale: 0.9 },
  },
  onion: {
    body: (c) => (
      <g>
        <path d="M100 25 C 96 45, 92 55, 90 62 M100 25 C 104 45, 108 55, 110 62" stroke="#8d6e63" strokeWidth={5} strokeLinecap="round" fill="none" />
        <path d="M100 60 C 55 60, 30 100, 32 135 C 35 175, 70 190, 100 190 C 130 190, 165 175, 168 135 C 170 100, 145 60, 100 60 Z" fill={c} {...outline(c)} />
        <path d="M75 70 C 60 110, 62 150, 75 185 M125 70 C 140 110, 138 150, 125 185" stroke={shade(c, -0.2)} strokeWidth={3} fill="none" />
      </g>
    ),
    face: { cx: 100, cy: 125, scale: 0.9 },
  },
  garlic: {
    body: (c) => (
      <g>
        <path d="M100 30 C 96 45, 94 52, 94 58 M100 30 C 104 45, 106 52, 106 58" stroke="#a1887f" strokeWidth={5} strokeLinecap="round" fill="none" />
        <path d="M100 55 C 60 55, 30 95, 35 140 C 40 180, 70 190, 100 190 C 130 190, 160 180, 165 140 C 170 95, 140 55, 100 55 Z" fill={c} {...outline(c)} />
        <path d="M80 62 C 62 100, 62 150, 78 185 M120 62 C 138 100, 138 150, 122 185" stroke={shade(c, -0.15)} strokeWidth={3} fill="none" />
      </g>
    ),
    face: { cx: 100, cy: 125, scale: 0.9 },
  },
  corn: {
    body: (c) => (
      <g>
        <path d="M40 60 C 30 120, 60 190, 100 190 C 140 190, 170 120, 160 60 C 140 35, 60 35, 40 60 Z" fill={c} {...outline(c)} />
        {[0, 1, 2, 3, 4].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <circle key={`${row}-${col}`} cx={58 + col * 28 + (row % 2) * 14} cy={62 + row * 26} r={9} fill={shade(c, 0.25)} stroke={shade(c, -0.15)} strokeWidth={1.5} />
          ))
        )}
        <path d="M40 60 C 20 100, 20 150, 45 185 L 60 175 C 45 140, 48 100, 62 62 Z" fill="#8bc34a" stroke="#558b2f" strokeWidth={3} />
        <path d="M160 60 C 180 100, 180 150, 155 185 L 140 175 C 155 140, 152 100, 138 62 Z" fill="#8bc34a" stroke="#558b2f" strokeWidth={3} />
      </g>
    ),
    face: { cx: 100, cy: 115, scale: 0.8 },
  },
  peach: {
    body: (c) => (
      <g>
        {leaf(104, 44, -30)}
        <path d="M100 55 C 60 40, 25 70, 30 115 C 34 160, 65 190, 100 188 C 135 190, 166 160, 170 115 C 175 70, 140 40, 100 55 Z" fill={c} {...outline(c)} />
        <path d="M100 55 C 96 100, 96 150, 100 188" stroke={shade(c, -0.15)} strokeWidth={3} fill="none" />
        {shine(60, 100)}
      </g>
    ),
    face: { cx: 100, cy: 118, scale: 1 },
  },
  cherry: {
    body: (c) => (
      <g>
        <path d="M70 110 C 75 60, 100 40, 130 20 M130 110 C 128 60, 130 40, 130 20" stroke="#5d4037" strokeWidth={6} strokeLinecap="round" fill="none" />
        {leaf(128, 20, 20)}
        <circle cx={62} cy={140} r={44} fill={c} {...outline(c)} />
        <circle cx={140} cy={145} r={42} fill={c} {...outline(c)} />
        {shine(45, 125, 6, 10)}
        {shine(125, 130, 6, 10)}
      </g>
    ),
    face: { cx: 62, cy: 142, scale: 0.55 },
  },
  pineapple: {
    body: (c) => (
      <g>
        <path d="M100 10 l -10 40 l -30 -30 l 16 44 l -40 -8 l 34 24 l -20 20 l 60 -30 l 60 30 l -20 -20 l 34 -24 l -40 8 l 16 -44 l -30 30 Z" fill="#43a047" stroke="#1b5e20" strokeWidth={3} strokeLinejoin="round" />
        <path d="M50 80 C 40 130, 55 190, 100 190 C 145 190, 160 130, 150 80 C 130 65, 70 65, 50 80 Z" fill={c} {...outline(c)} />
        <path d="M50 100 L 150 160 M50 130 L 140 185 M60 80 L 152 130 M150 100 L 50 160 M150 130 L 60 185 M140 80 L 48 130" stroke={shade(c, -0.25)} strokeWidth={2} />
      </g>
    ),
    face: { cx: 100, cy: 130, scale: 0.8 },
  },
  burger: {
    body: (c) => (
      <g>
        <path d="M30 95 C 30 50, 170 50, 170 95 Z" fill="#e8a951" stroke="#a9744d" strokeWidth={4} />
        {[[60, 70], [95, 62], [130, 72], [80, 82], [120, 85]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={4} ry={2.5} fill="#fff8e1" />
        ))}
        <path d="M28 100 L 172 100 L 176 112 C 150 108, 140 124, 120 112 C 100 128, 80 108, 60 120 C 45 126, 35 112, 24 112 Z" fill="#7cb342" stroke="#33691e" strokeWidth={3} />
        <rect x={32} y={116} width={136} height={20} rx={6} fill={c} {...outline(c)} />
        <path d="M30 138 L 170 138 L 160 150 L 40 150 Z" fill="#ffca28" stroke="#c79100" strokeWidth={3} />
        <path d="M32 152 L 168 152 C 168 180, 160 190, 140 190 L 60 190 C 40 190, 32 180, 32 152 Z" fill="#e8a951" stroke="#a9744d" strokeWidth={4} />
      </g>
    ),
    face: { cx: 100, cy: 78, scale: 0.55 },
  },
  taco: {
    body: (c) => (
      <g>
        <path d="M20 150 C 20 70, 180 70, 180 150 Z" fill="#f2c14e" stroke="#b8860b" strokeWidth={4} />
        <path d="M35 130 C 60 95, 140 95, 165 130 C 150 110, 130 122, 110 108 C 90 122, 70 110, 55 125 Z" fill="#7cb342" stroke="#33691e" strokeWidth={2} />
        <path d="M40 136 C 70 112, 130 112, 160 136 Z" fill={c} {...outline(c)} />
        <path d="M20 150 C 20 100, 60 80, 100 80 L 100 190 C 60 190, 20 175, 20 150 Z" fill="#f2c14e" stroke="#b8860b" strokeWidth={4} />
        <path d="M180 150 C 180 100, 140 80, 100 80 L 100 190 C 140 190, 180 175, 180 150 Z" fill="#e6b53e" stroke="#b8860b" strokeWidth={4} />
      </g>
    ),
    face: { cx: 100, cy: 140, scale: 0.7 },
  },
  sushi: {
    body: (c) => (
      <g>
        <path d="M40 120 C 40 95, 160 95, 160 120 L 160 165 C 160 185, 40 185, 40 165 Z" fill="#fafafa" stroke="#bdbdbd" strokeWidth={4} />
        {[[55, 135], [80, 150], [110, 140], [140, 155], [65, 165], [125, 170]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="#e0e0e0" />
        ))}
        <path d="M45 95 C 45 70, 155 70, 155 95 C 155 115, 45 115, 45 95 Z" fill={c} {...outline(c)} />
        <path d="M55 88 L 145 88 M52 102 L 148 102" stroke={shade(c, 0.4)} strokeWidth={3} opacity={0.8} />
        <rect x={85} y={70} width={30} height={120} fill="#1b5e20" opacity={0.9} rx={4} />
      </g>
    ),
    face: { cx: 100, cy: 140, scale: 0.55 },
  },
  cupcake: {
    body: (c) => (
      <g>
        <path d="M45 120 L 55 190 L 145 190 L 155 120 Z" fill="#f48fb1" stroke="#ad1457" strokeWidth={4} />
        <path d="M65 120 L 70 188 M100 120 L 100 188 M135 120 L 130 188" stroke="#ec407a" strokeWidth={3} />
        <path d="M40 120 C 30 95, 60 90, 65 100 C 60 70, 95 65, 100 80 C 105 55, 145 60, 140 90 C 150 80, 175 95, 160 120 Z" fill={c} {...outline(c)} />
        <circle cx={100} cy={58} r={11} fill="#e53935" stroke="#b71c1c" strokeWidth={2} />
        {[[70, 105, "#fff176"], [120, 100, "#80deea"], [95, 112, "#fff"], [140, 108, "#a5d6a7"]].map(([x, y, col], i) => (
          <rect key={i} x={Number(x)} y={Number(y)} width={10} height={4} rx={2} fill={String(col)} transform={`rotate(${i * 35} ${x} ${y})`} />
        ))}
      </g>
    ),
    face: { cx: 100, cy: 152, scale: 0.55 },
  },
  icecream: {
    body: (c) => (
      <g>
        <path d="M60 110 L 100 195 L 140 110 Z" fill="#e8a951" stroke="#a9744d" strokeWidth={4} strokeLinejoin="round" />
        <path d="M70 125 L 130 125 M78 145 L 122 145 M88 165 L 112 165 M85 115 L 108 175 M115 115 L 92 175" stroke="#c9843a" strokeWidth={2} />
        <circle cx={100} cy={75} r={46} fill={c} {...outline(c)} />
        <path d="M58 90 C 60 105, 70 100, 72 112 C 78 100, 90 105, 92 118 C 98 105, 110 108, 112 116 C 118 102, 132 106, 136 100 C 140 92, 142 86, 142 84 L 58 84 Z" fill={shade(c, -0.15)} />
        {shine(80, 60, 8, 12)}
      </g>
    ),
    face: { cx: 100, cy: 72, scale: 0.7 },
  },
  coffee: {
    body: (c) => (
      <g>
        <path d="M130 90 C 170 85, 180 130, 145 145 L 140 128 C 158 122, 155 100, 132 105 Z" fill="#fafafa" stroke="#bdbdbd" strokeWidth={4} />
        <path d="M40 70 L 150 70 L 140 170 C 138 185, 130 190, 120 190 L 70 190 C 60 190, 52 185, 50 170 Z" fill="#fafafa" stroke="#bdbdbd" strokeWidth={4} />
        <path d="M45 70 L 145 70 C 145 78, 45 78, 45 70 Z" fill={c} {...outline(c)} />
        <path d="M70 55 C 66 45, 74 40, 70 30 M95 55 C 91 45, 99 40, 95 30 M120 55 C 116 45, 124 40, 120 30" stroke="#bdbdbd" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.8} />
      </g>
    ),
    face: { cx: 95, cy: 125, scale: 0.75 },
  },
};
