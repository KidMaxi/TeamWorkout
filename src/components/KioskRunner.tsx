"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { PinPad } from "@/components/PinPad";
import { WorkoutRunner, type RunnerApi } from "@/components/WorkoutRunner";
import {
  kioskDeleteRunSet, kioskFinishRun, kioskSaveRunSet, kioskStartRun, verifyAthletePin,
} from "@/app/team/[id]/kiosk/actions";

const IDLE_MS = 120_000;
const DONE_MS = 6_000;

type RunnerProps = Omit<
  React.ComponentProps<typeof WorkoutRunner>,
  "api" | "onFinished" | "renderFinished" | "athleteName" | "backLabel" | "teamId" | "sessionId" | "sessionsHref"
>;

/** Returns to the grid after the screen has been left alone while `active`. */
function useIdleReturn(active: boolean, gridHref: string) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let timer = window.setTimeout(go, IDLE_MS);
    function go() {
      router.replace(gridHref);
    }
    function bump() {
      window.clearTimeout(timer);
      timer = window.setTimeout(go, IDLE_MS);
    }
    const events = ["pointerdown", "touchstart", "keydown"] as const;
    for (const e of events) window.addEventListener(e, bump, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, bump);
    };
  }, [active, gridHref, router]);
}

function Done({ name, gridHref }: { name: string; gridHref: string }) {
  const { t } = useT();
  const router = useRouter();
  useEffect(() => {
    const id = window.setTimeout(() => router.replace(gridHref), DONE_MS);
    return () => window.clearTimeout(id);
  }, [gridHref, router]);
  return (
    <section className="rise mx-auto flex w-full max-w-md flex-col items-center gap-5 py-10 text-center" role="status">
      <span aria-hidden className="grid size-20 place-items-center rounded-full" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
        <Check size={40} />
      </span>
      <h2 className="display text-4xl leading-tight">{t("kiosk.done.title", { name })}</h2>
      <p className="text-lg text-muted">{t("kiosk.done.body")}</p>
      <p className="text-sm text-muted">{t("kiosk.done.auto")}</p>
      <Link href={gridHref} replace className="btn btn-primary inline-flex min-h-14 items-center justify-center px-8 text-lg">
        {t("kiosk.done.back")}
      </Link>
    </section>
  );
}

/**
 * Client wrapper for one athlete in iPad mode: PIN gate (when the team requires it), then the
 * normal runner wired to the kiosk actions. The PIN lives in a ref in this component only.
 */
export function KioskRunner({
  teamId, sessionId, userId, athleteName, requirePin, gridHref, ...runner
}: RunnerProps & {
  teamId: string;
  sessionId: string;
  userId: string;
  athleteName: string;
  requirePin: boolean;
  gridHref: string;
}) {
  const { t } = useT();
  const pinRef = useRef<string | null>(null);
  const [unlocked, setUnlocked] = useState(!requirePin);
  const [started, setStarted] = useState(!!runner.startedAt);
  const [done, setDone] = useState(!!runner.finished);

  // Reset only on the PIN pad or before the first set is saved; never while a workout is running.
  useIdleReturn(!unlocked || (!started && !done), gridHref);

  const api = useMemo<RunnerApi>(() => ({
    start: async () => {
      const r = await kioskStartRun(teamId, sessionId, userId, pinRef.current);
      if (r.ok) setStarted(true);
      return r;
    },
    saveSet: (p) => kioskSaveRunSet(teamId, sessionId, userId, pinRef.current, p),
    deleteSet: (ex, i, side) => kioskDeleteRunSet(teamId, sessionId, userId, pinRef.current, ex, i, side),
    finish: (d, r) => kioskFinishRun(teamId, sessionId, userId, pinRef.current, d, r),
  }), [teamId, sessionId, userId]);

  const checkPin = useCallback(async (pin: string): Promise<MessageKey | null> => {
    const r = await verifyAthletePin(teamId, sessionId, userId, pin);
    if (!r.ok) return r.error ?? "kiosk.pin.error";
    pinRef.current = pin;
    setUnlocked(true);
    return null;
  }, [teamId, sessionId, userId]);

  if (!unlocked) {
    return (
      <section className="rise mx-auto flex w-full max-w-md flex-col items-center gap-5 py-4">
        <Avatar name={athleteName} size={72} />
        <div className="text-center">
          <h2 className="display text-4xl leading-tight">{t("kiosk.pin.title", { name: athleteName })}</h2>
          <p className="mt-2 text-lg text-muted">{t("kiosk.pin.body")}</p>
        </div>
        <PinPad onSubmit={checkPin} />
        <Link href={gridHref} replace className="link inline-flex min-h-14 items-center px-4 text-base">
          {t("kiosk.pin.other")}
        </Link>
      </section>
    );
  }

  return (
    <WorkoutRunner
      {...runner}
      teamId={teamId}
      sessionId={sessionId}
      sessionsHref={gridHref}
      api={api}
      athleteName={athleteName}
      backLabel="kiosk.run.back"
      onFinished={() => {
        pinRef.current = null;
        setDone(true);
      }}
      renderFinished={() => <Done name={athleteName} gridHref={gridHref} />}
    />
  );
}
