'use client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState } from 'react';
import { cycles, statusLabels, type Task, type Goal } from '@/lib/domain';
export function Picker({
  value,
  onChange,
  options,
  label,
  className = '',
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v !== null && onChange(String(v))}
      disabled={disabled}
    >
      <SelectTrigger className={`picker ${className}`} aria-label={label}>
        <SelectValue>{options[value] ?? label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([k, v]) => (
          <SelectItem key={k} value={k}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function TaskEditor({
  task,
  day,
  goals,
  onClose,
  onSave,
}: {
  task: Task | 'new' | null;
  day: string;
  goals: Goal[];
  onClose: () => void;
  onSave: (t: Task) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Task | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setError('');
    setDraft(
      task === 'new'
        ? {
            id: crypto.randomUUID(),
            title: '',
            notes: '',
            status: 'todo',
            plannedDate: day,
            startAt: '',
            deadline: '',
            goalId: '',
            createdAt: Date.now(),
            completedAt: null,
            carried: 0,
          }
        : task,
    );
  }, [task, day]);
  const set = (key: keyof Task, value: unknown) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>
            {task === 'new' ? 'Make a little plan' : 'Edit task'}
          </DialogTitle>
          <DialogDescription>
            Give your next step a name and a place in your day.
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!draft.title.trim()) return;
              if (
                draft.startAt &&
                draft.deadline &&
                draft.deadline < draft.startAt
              ) {
                setError('The deadline needs to be after the start time.');
                return;
              }
              setBusy(true);
              if (await onSave({ ...draft, title: draft.title.trim() }))
                onClose();
              setBusy(false);
            }}
            className="editor-form"
          >
            <label>
              Task
              <Input
                required
                maxLength={200}
                value={draft.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="What would you like to work on?"
              />
            </label>
            <label>
              Notes <span className="optional">optional</span>
              <Textarea
                maxLength={5000}
                value={draft.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="A few details to help you get started"
              />
            </label>
            <div className="form-grid">
              <label>
                Planned day
                <Input
                  type="date"
                  required
                  value={draft.plannedDate}
                  onChange={(e) => set('plannedDate', e.target.value)}
                />
              </label>
              <label>
                Status
                <Picker
                  label="Task status"
                  value={draft.status}
                  onChange={(v) => {
                    set('status', v);
                    set('completedAt', v === 'done' ? Date.now() : null);
                  }}
                  options={statusLabels}
                />
              </label>
              <label>
                Start time <span className="optional">optional</span>
                <Input
                  type="datetime-local"
                  value={draft.startAt}
                  onChange={(e) => set('startAt', e.target.value)}
                />
              </label>
              <label>
                Deadline <span className="optional">optional</span>
                <Input
                  type="datetime-local"
                  value={draft.deadline}
                  min={draft.startAt || undefined}
                  onChange={(e) => set('deadline', e.target.value)}
                />
              </label>
            </div>
            <label>
              Linked goal
              <Picker
                label="Linked goal"
                value={draft.goalId}
                onChange={(v) => set('goalId', v)}
                options={{
                  '': 'No linked goal',
                  ...Object.fromEntries(goals.map((g) => [g.id, g.title])),
                }}
              />
            </label>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy
                  ? 'Saving…'
                  : task === 'new'
                    ? 'Add task'
                    : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function GoalEditor({
  goal,
  onClose,
  onSave,
}: {
  goal: Goal | 'new' | null;
  onClose: () => void;
  onSave: (g: Goal) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Goal | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setDraft(
      goal === 'new'
        ? {
            id: crypto.randomUUID(),
            title: '',
            target: 300,
            deadline: '',
            createdAt: Date.now(),
          }
        : goal,
    );
  }, [goal]);
  return (
    <Dialog open={goal !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>
            {goal === 'new' ? 'Give your focus a direction' : 'Edit goal'}
          </DialogTitle>
          <DialogDescription>
            Focus time on linked tasks contributes to your goal.
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!draft.title.trim()) return;
              setBusy(true);
              if (await onSave({ ...draft, title: draft.title.trim() }))
                onClose();
              setBusy(false);
            }}
          >
            <label>
              Goal
              <Input
                required
                value={draft.title}
                maxLength={200}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Make time for learning"
              />
            </label>
            <div className="form-grid">
              <label>
                Target focus minutes
                <Input
                  type="number"
                  min={1}
                  max={100000}
                  step={1}
                  required
                  value={draft.target}
                  onChange={(e) =>
                    setDraft({ ...draft, target: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Target date <span className="optional">optional</span>
                <Input
                  type="date"
                  value={draft.deadline}
                  onChange={(e) =>
                    setDraft({ ...draft, deadline: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save goal'}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
export { cycles };
