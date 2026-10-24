'use client';

import { useRef, useState } from 'react';
import { btnGold, btnOutline } from '@/components/cost-reduction/spend/ui';

export interface KitAction {
  label: string;
  /** Label while `busy` (e.g. "Opening the sample…"). */
  busyLabel?: string;
  onClick?: () => void;
  href?: string;
  busy?: boolean;
  disabled?: boolean;
}

export interface KitUpload {
  label: string;
  busyLabel?: string;
  /** Value for the file input's accept attribute, e.g. ".xlsx,.xls". */
  accept: string;
  onFile: (file: File) => void;
  busy?: boolean;
  disabled?: boolean;
}

export interface KitPanelProps {
  /** Anchor id; the heading gets `${id}-title` for aria-labelledby. */
  id: string;
  title: string;
  blurb: string;
  eyebrow?: string;
  /** The one-click demo — the gold button. */
  primary?: KitAction;
  /** "Upload a filled template" — also accepts a file dropped anywhere on the panel. */
  upload?: KitUpload;
  /** "Download sample" / "Download blank template". */
  downloads?: { label: string; onClick: () => void; disabled?: boolean }[];
  /** Sentence shown beside the download links. */
  downloadsHint?: string;
  /** Small print under the panel (privacy, "sample is fictional"). */
  note?: string;
  error?: string | null;
  /** Anything that belongs inside the panel, e.g. an import preview. */
  children?: React.ReactNode;
  className?: string;
}

const linkBtn = 'font-medium text-eccellere-gold hover:underline disabled:opacity-50';

/**
 * The standard "sample data kit" panel every module shows: a one-click demo, an optional upload of a filled
 * template, downloads of the sample and the blank template, and a note on what happens to the data. One component
 * so every module's kit looks and behaves the same (the standing rule: every module ships all three).
 */
export default function KitPanel(p: KitPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const titleId = `${p.id}-title`;
  const busy = !!p.primary?.busy || !!p.upload?.busy;

  return (
    <section
      id={p.id}
      aria-labelledby={titleId}
      onDragOver={p.upload ? e => { e.preventDefault(); setDragOver(true); } : undefined}
      onDragLeave={p.upload ? () => setDragOver(false) : undefined}
      onDrop={p.upload ? e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f && !p.upload!.disabled) p.upload!.onFile(f); } : undefined}
      className={`border p-5 transition-colors md:p-6 ${dragOver ? 'border-eccellere-gold bg-eccellere-gold-pale' : 'border-eccellere-border bg-white'} ${p.className ?? ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[260px] flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-eccellere-gold">{p.eyebrow ?? 'Sample data kit'}</div>
          <h2 id={titleId} className="font-display m-0 mt-1 text-[clamp(18px,2.2vw,22px)] font-light text-eccellere-ink">{p.title}</h2>
          <p className="m-0 mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-eccellere-ink-light">{p.blurb}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {p.primary && (p.primary.href && !p.primary.busy
            ? <a href={p.primary.href} className={`${btnGold} inline-block`}>{p.primary.label}</a>
            : <button type="button" disabled={busy || p.primary.disabled} onClick={p.primary.onClick} className={btnGold}>{p.primary.busy ? (p.primary.busyLabel ?? p.primary.label) : p.primary.label}</button>)}
          {p.upload && (
            <>
              <button type="button" disabled={busy || p.upload.disabled} onClick={() => inputRef.current?.click()} className={btnOutline}>{p.upload.busy ? (p.upload.busyLabel ?? p.upload.label) : p.upload.label}</button>
              <input ref={inputRef} type="file" accept={p.upload.accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) p.upload!.onFile(f); e.target.value = ''; }} />
            </>
          )}
        </div>
      </div>

      {p.error && <p role="alert" className="mb-0 mt-4 text-[13px] font-medium text-eccellere-error">{p.error}</p>}
      {p.children}

      {p.downloads && p.downloads.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-eccellere-border pt-4 text-[12.5px] text-eccellere-ink-light">
          <span>{p.downloadsHint ?? 'New to this? See exactly what goes where, or start from a blank copy with a “How to fill” guide.'}</span>
          <div className="flex flex-wrap gap-4">
            {p.downloads.map(d => <button key={d.label} type="button" onClick={d.onClick} disabled={d.disabled} className={linkBtn}>{d.label}</button>)}
          </div>
        </div>
      )}
      {p.note && <p className="m-0 mt-3 text-[11.5px] text-eccellere-ink-light">{p.note}</p>}
    </section>
  );
}
