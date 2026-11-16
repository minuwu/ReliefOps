import type { Note } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import { Send } from 'lucide-react';

export interface CaseNotesSectionProps {
  notes: Note[];
  canWrite: boolean;
  noteText: string;
  onNoteTextChange: (text: string) => void;
  onSubmitNote: (e: React.FormEvent) => Promise<void> | void;
  isSubmittingNote: boolean;
}

export function CaseNotesSection({
  notes,
  canWrite,
  noteText,
  onNoteTextChange,
  onSubmitNote,
  isSubmittingNote,
}: CaseNotesSectionProps) {
  return (
    <div className="p-4 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/30 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#09090B]">
        Operator notes ({notes.length})
      </h3>

      {canWrite && (
        <form onSubmit={(e) => void onSubmitNote(e)} className="space-y-2">
          <textarea
            aria-label="New case note"
            value={noteText}
            onChange={(e) => onNoteTextChange(e.target.value)}
            placeholder="Record verification notes, dispatch reference, or victim contact log..."
            rows={2}
            className="w-full text-xs font-medium rounded-xl border border-[#09090B]/20 bg-[#F8F4E8] p-3 focus:outline-none focus:border-[#09090B] placeholder:text-[#71717A]"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              type="submit"
              isLoading={isSubmittingNote}
              disabled={!noteText.trim()}
              className="gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Post note
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-xs text-[#52525B] italic">No notes recorded yet.</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="p-3 rounded-lg border border-[#09090B]/10 bg-[#F8F4E8] text-xs space-y-1"
            >
              <div className="flex justify-between font-bold text-[#09090B]">
                <span>{note.author.name}</span>
                <span className="text-xs font-mono text-[#52525B] font-normal">
                  {formatDateTime(note.created_at)}
                </span>
              </div>
              <p className="text-[#09090B] font-normal leading-relaxed">{note.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
