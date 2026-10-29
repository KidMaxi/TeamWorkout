type MarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

/** Merkteken: drie stijgende load-balken (team + progressie). Themet via --primary. */
export function LogoMark({ size = 28, className, title }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <rect x="8" y="36" width="14" height="20" rx="3" fill="var(--primary)" opacity=".5" />
      <rect x="25" y="22" width="14" height="34" rx="3" fill="var(--primary)" opacity=".75" />
      <rect x="42" y="6" width="14" height="50" rx="3" fill="var(--primary)" />
    </svg>
  );
}

export function Logo({
  size = 32,
  className = "",
  wordmarkClassName = "text-3xl font-extrabold tracking-tight",
}: {
  size?: number;
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className={wordmarkClassName}>
        Team<span className="text-primary">Workout</span>
      </span>
    </span>
  );
}
