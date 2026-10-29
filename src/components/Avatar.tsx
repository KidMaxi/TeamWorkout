/** Monogram avatar: initials on a carbon disc with a champagne ring. */
export function Avatar({ name, size = 40, className = "" }: { name: string; size?: number; className?: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-display font-bold text-[var(--accent)] ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))",
        boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent), 0 1px 0 rgb(255 255 255 / 0.08) inset",
      }}
    >
      {initials}
    </span>
  );
}
