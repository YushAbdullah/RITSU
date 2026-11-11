// Proof (photo / receipt / link), mood pickers and the guardian's reactions to purchases.
import { useState } from 'react';
import type { MoodKind, Proof, ReactionKind } from '../lib/types';
import { Seg, Sheet } from './ui';

export const MOODS: { value: MoodKind; emoji: string; label: string }[] = [
  { value: 'happy', emoji: '😄', label: "I'm happy" },
  { value: 'excited', emoji: '🤩', label: "I'm excited" },
  { value: 'ok', emoji: '🙂', label: "I'm ok" },
  { value: 'meh', emoji: '😐', label: 'So-so' },
  { value: 'sad', emoji: '😢', label: "I'm sad" },
  { value: 'angry', emoji: '😠', label: "I'm upset" },
];
export const moodOf = (m?: MoodKind) => MOODS.find((x) => x.value === m);

export const REACTIONS: { value: ReactionKind; label: string }[] = [
  { value: 'great', label: '👍 Good choice' },
  { value: 'ok', label: '🙂 Okay' },
  { value: 'why', label: '🤔 Why so much?' },
  { value: 'talk', label: "💬 Let's talk" },
];

/** Shrinks a photo so it fits comfortably in on-device storage (about 30 to 80 KB). */
export async function compressImage(file: File, max = 720, quality = 0.62): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error('That file is not a picture we can read.'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('This browser cannot process photos.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const isLink = (u: string) => /^https?:\/\/\S+\.\S+/i.test(u.trim());

/** Attach a photo (camera or gallery) or paste a link. Calls onChange with a valid Proof or undefined. */
export function ProofInput({ value, onChange, label, required, id = 'proof' }: { value?: Proof; onChange: (p?: Proof) => void; label: string; required?: boolean; id?: string }) {
  const [mode, setMode] = useState<'photo' | 'link'>(value?.kind ?? 'photo');
  const [link, setLink] = useState(value?.kind === 'link' ? value.url : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true); setErr(null);
    try { onChange({ kind: 'photo', url: await compressImage(f), name: f.name }); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="field">
      <label htmlFor={`${id}-${mode}`}>{label} {required ? <span className="muted">(required)</span> : <span className="muted">(optional)</span>}</label>
      <Seg label="Proof type" value={mode} onChange={(m) => { setMode(m); onChange(undefined); setErr(null); }} options={[{ value: 'photo', label: '📷 Photo' }, { value: 'link', label: '🔗 Link' }]} />
      {mode === 'photo' ? (
        value?.kind === 'photo' ? (
          <div className="proof-chosen">
            <img src={value.url} alt="Attached proof" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(undefined)}>Remove</button>
          </div>
        ) : (
          <label className="proof-drop" htmlFor={`${id}-photo`}>
            <span aria-hidden="true" style={{ fontSize: 24 }}>📷</span>
            <span>{busy ? 'Preparing photo…' : 'Take a photo or choose a picture of the receipt or item'}</span>
            <input id={`${id}-photo`} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        )
      ) : (
        <input id={`${id}-link`} className="input" type="url" inputMode="url" placeholder="https://… (e-receipt, order page, shared photo)" value={link}
          onChange={(e) => { setLink(e.target.value); onChange(isLink(e.target.value) ? { kind: 'link', url: e.target.value.trim() } : undefined); }} />
      )}
      {mode === 'link' && link && !isLink(link) && <span className="small" style={{ color: 'var(--danger)' }}>Paste a full link starting with https://</span>}
      {err && <span className="small" style={{ color: 'var(--danger)' }}>{err}</span>}
    </div>
  );
}

/** Small thumbnail or link chip; tapping a photo opens it full size. */
export function ProofView({ proof }: { proof?: Proof }) {
  const [open, setOpen] = useState(false);
  if (!proof) return null;
  if (proof.kind === 'link') {
    let host = proof.url;
    try { host = new URL(proof.url).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
    return <a className="chip proof-link" href={proof.url} target="_blank" rel="noopener noreferrer">🔗 {host}</a>;
  }
  return (
    <>
      <button type="button" className="proof-thumb" onClick={() => setOpen(true)} aria-label="View proof photo"><img src={proof.url} alt="" /></button>
      {open && <Sheet title="Proof" onClose={() => setOpen(false)}><img src={proof.url} alt="Proof photo" style={{ width: '100%', borderRadius: 12 }} /></Sheet>}
    </>
  );
}

export function MoodPicker({ value, onChange, label = 'How do you feel?' }: { value?: MoodKind; onChange: (m: MoodKind) => void; label?: string }) {
  return (
    <div className="mood-row" role="radiogroup" aria-label={label}>
      {MOODS.map((m) => (
        <button key={m.value} type="button" role="radio" aria-checked={value === m.value} className="mood" onClick={() => onChange(m.value)}>
          <span className="e" aria-hidden="true">{m.emoji}</span><span className="l">{m.label}</span>
        </button>
      ))}
    </div>
  );
}
