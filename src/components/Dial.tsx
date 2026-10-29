import type { ReactNode } from "react";

type Tone = "primary" | "accent" | "warn" | "danger";

const TONE: Record<Tone, string> = {
  primary: "var(--primary)",
  accent: "var(--accent)",
  warn: "var(--warn)",
  danger: "var(--danger)",
};

/**
 * Load Dial: the signature gauge. A bezel of fine ticks, a progress arc, and an optional
 * notch marking a reference value (e.g. the 28-day average). Children render in the centre.
 * Pure SVG, server-renderable, animates in via CSS (see globals.css).
 */
export function Dial({
  value,
  marker,
  size = 220,
  tone = "primary",
  ticks = 60,
  label,
  children,
  className = "",
}: {
  /** Progress 0..1 (values above 1 are clamped for the arc) */
  value: number;
  /** Optional reference position 0..1, shown as a notch on the bezel */
  marker?: number;
  size?: number;
  tone?: Tone;
  ticks?: number;
  /** Accessible description of what the dial shows */
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  const c = size / 2;
  // Small dials (roster rows) drop the bezel: a bold arc with room for the number.
  const mini = size < 100;
  const stroke = mini ? 5 : 6;
  const tickOuter = c - 2;
  const tickInner = c - 12;
  const arcR = mini ? c - stroke : c - 24;
  const len = 2 * Math.PI * arcR;
  const sweep = 0.75; // 270 degrees, gap at the bottom
  const arcLen = len * sweep;
  const off = arcLen * (1 - v);
  const color = TONE[tone];
  const startAngle = 135; // degrees, measured clockwise from 3 o'clock

  const pt = (angleDeg: number, r: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return [c + r * Math.cos(a), c + r * Math.sin(a)] as const;
  };

  const tickEls = mini ? [] : Array.from({ length: ticks + 1 }, (_, i) => {
    const f = i / ticks;
    const angle = startAngle + f * 270;
    const major = i % 5 === 0;
    const [x1, y1] = pt(angle, tickOuter);
    const [x2, y2] = pt(angle, major ? tickInner - 3 : tickInner + 2);
    const lit = f <= v + 1e-6;
    return (
      <line
        key={i}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={lit ? color : "var(--line)"}
        strokeWidth={major ? 2 : 1}
        strokeLinecap="round"
        opacity={lit ? (major ? 1 : 0.7) : 1}
        className="dial-tick"
      />
    );
  });

  const markerEl = marker !== undefined && (() => {
    const m = Math.max(0, Math.min(1, marker));
    const angle = startAngle + m * 270;
    const [x1, y1] = pt(angle, mini ? arcR + stroke : tickOuter + 1);
    const [x2, y2] = pt(angle, mini ? arcR - stroke : arcR - 8);
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" />;
  })();

  return (
    <div className={`relative inline-grid place-items-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        {tickEls}
        {/* track */}
        <circle
          cx={c} cy={c} r={arcR} fill="none" stroke="var(--line)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${arcLen} ${len}`} transform={`rotate(${startAngle} ${c} ${c})`}
        />
        {/* progress */}
        <circle
          cx={c} cy={c} r={arcR} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${arcLen} ${len}`} strokeDashoffset={off}
          transform={`rotate(${startAngle} ${c} ${c})`}
          className="dial-arc"
          style={{ ["--dial-len" as string]: arcLen, ["--dial-off" as string]: off, filter: mini ? undefined : `drop-shadow(0 0 6px ${color})` }}
        />
        {markerEl}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center" style={{ padding: size * (mini ? 0.16 : 0.22) }}>
        {children}
      </div>
    </div>
  );
}
