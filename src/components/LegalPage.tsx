import Link from "next/link";
import { ChevronLeft, TriangleAlert } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { LEGAL } from "@/lib/legal";
import { LogoMark } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LegalLinks } from "@/components/LegalLinks";
import type { Block, Doc } from "@/lib/legal-content/shared";

/** Renders [bracketed] placeholders with a visible warning style so they cannot be missed. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[") && p.endsWith("]") ? (
          <mark key={i} className="rounded px-1 font-semibold" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function BlockView({ block, scrollLabel }: { block: Block; scrollLabel: string }) {
  if (typeof block === "string") return <p className="text-sm leading-relaxed text-muted"><Rich text={block} /></p>;
  if ("list" in block) {
    return (
      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted marker:text-[var(--accent)]">
        {block.list.map((i) => <li key={i}><Rich text={i} /></li>)}
      </ul>
    );
  }
  const { head, rows } = block.table;
  return (
    <div className="-mx-1 overflow-x-auto rounded-lg" role="region" aria-label={scrollLabel} tabIndex={0}>
      <table className="w-full min-w-[34rem] border-collapse text-left text-xs leading-relaxed">
        <thead>
          <tr>{head.map((h) => <th key={h} scope="col" className="border-b px-2 py-2 align-bottom">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="align-top">
              {r.map((c, ci) => (
                ci === 0
                  ? <th key={ci} scope="row" className="border-b px-2 py-2 text-[var(--foreground)] normal-case tracking-normal text-xs font-semibold"><Rich text={c} /></th>
                  : <td key={ci} className="border-b px-2 py-2 text-muted"><Rich text={c} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function LegalPage({ doc }: { doc: Doc }) {
  const { t } = await getT();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="inline-flex min-h-10 items-center gap-2" aria-label={t("legal.backToApp")}>
          <ChevronLeft size={20} aria-hidden className="text-[var(--accent)]" />
          <LogoMark size={24} />
          <span className="text-sm text-muted">{t("legal.backToApp")}</span>
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="space-y-6">
        <div className="space-y-3 pt-2">
          <p className="eyebrow">{t("legal.lastUpdated", { version: LEGAL.termsVersion })}</p>
          <h1 className="display text-3xl">{doc.title}</h1>
          {doc.intro && <p className="text-sm leading-relaxed text-muted">{doc.intro}</p>}
        </div>

        {!LEGAL.reviewed && (
          <div role="note" className="flex gap-3 rounded-2xl border p-4 text-sm" style={{ background: "var(--warn-bg)", color: "var(--warn)", borderColor: "var(--warn)" }}>
            <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
            <p><strong>{t("legal.draft.title")}.</strong> {t("legal.draft.text")}</p>
          </div>
        )}

        <nav aria-label={t("legal.toc")} className="card">
          <h2 className="eyebrow mb-2">{t("legal.toc")}</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm marker:text-[var(--accent)]">
            {doc.sections.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="link">{s.title}</a></li>
            ))}
          </ol>
        </nav>

        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="card scroll-mt-20 space-y-3">
            <h2 id={`${s.id}-h`} className="display text-lg leading-tight">{s.title}</h2>
            {s.body.map((b, i) => <BlockView key={i} block={b} scrollLabel={t("legal.table.scroll")} />)}
          </section>
        ))}
      </main>

      <LegalLinks className="mt-8" />
    </div>
  );
}
