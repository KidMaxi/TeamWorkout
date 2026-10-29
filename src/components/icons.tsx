import {
  Ban, CircleAlert, CircleCheck, Dumbbell, GraduationCap, Moon, Trophy, Circle,
  type LucideIcon,
} from "lucide-react";
import type { Availability, SessionType } from "@/lib/load";

export * from "lucide-react";

const SESSION_ICONS: Record<SessionType, LucideIcon> = {
  academy: GraduationCap,
  gym: Dumbbell,
  evening: Moon,
  match: Trophy,
  other: Circle,
};

const AVAILABILITY_ICONS: Record<Availability, LucideIcon> = {
  available: CircleCheck,
  limited: CircleAlert,
  unavailable: Ban,
};

export function SessionTypeIcon({ type, size = 16, className }: { type: SessionType; size?: number; className?: string }) {
  const Icon = SESSION_ICONS[type] ?? Circle;
  return <Icon size={size} className={className} aria-hidden />;
}

export function AvailabilityIcon({ status, size = 16, className }: { status: Availability; size?: number; className?: string }) {
  const Icon = AVAILABILITY_ICONS[status] ?? CircleCheck;
  return <Icon size={size} className={className} aria-hidden />;
}
