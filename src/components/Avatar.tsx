/** Monogram avatar: initials on a flat charcoal disc with a thin border. */
export function Avatar({ name, size = 40, className = "" }: { name: string; size?: number; className?: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-display text-[var(--accent)] ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: "var(--surface-3)",
        border: "1px solid var(--line)",
      }}
    >
      {initials}
    </span>
  );
}
