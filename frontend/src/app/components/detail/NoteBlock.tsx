import { useEffect, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { useTranslation } from '@/app/i18n';

interface NoteBlockProps {
  note: string;
  onSave: (note: string) => Promise<void>;
}

/** „Deine Notiz" – inline editierbar, speichert beim Verlassen des Feldes. */
export function NoteBlock({ note, onSave }: NoteBlockProps) {
  const { t } = useTranslation();
  const d = t.kitchen.detail;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(note);
  }, [note]);

  const commit = async () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed === (note ?? '').trim()) return;
    setIsSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mt-[30px] rounded-[18px] border border-[oklch(0.78_0.08_110_/_.5)] bg-sage/[.38] px-[22px] py-[18px]">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[oklch(0.42_0.08_130)]">
        {d.yourNote}
        {isSaving && <Loader2 className="size-3 animate-spin" />}
      </div>

      {isEditing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setDraft(note);
              setIsEditing(false);
            }
          }}
          rows={Math.max(3, draft.split('\n').length + 1)}
          placeholder={d.notePlaceholder}
          className="mt-[9px] w-full resize-y rounded-xl border border-[oklch(0.78_0.08_110_/_.6)] bg-white/70 px-3 py-2 text-[15.5px] leading-[1.6] text-[oklch(0.3_0.04_60)] outline-none focus:border-herb"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="group mt-[9px] flex w-full items-start gap-3 text-left"
        >
          <p
            className={
              note
                ? 'flex-1 whitespace-pre-line text-[15.5px] leading-[1.6] text-[oklch(0.3_0.04_60)] [text-wrap:pretty]'
                : 'flex-1 text-[15.5px] leading-[1.6] text-[oklch(0.5_0.05_120)] italic'
            }
          >
            {note || d.notePlaceholder}
          </p>
          <Pencil className="mt-1 size-4 shrink-0 text-[oklch(0.42_0.08_130)] opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
    </section>
  );
}
