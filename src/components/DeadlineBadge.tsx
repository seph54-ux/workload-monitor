import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { getDeadlineStatus, type DeadlineStatus } from '../lib/dates';

interface DeadlineBadgeProps {
  commitmentDate: string | null | undefined;
  finishedDate: string | null | undefined;
}

const CONFIG: Record<
  DeadlineStatus,
  { label: string; textClass: string; Icon: typeof CheckCircle2 | null }
> = {
  overdue: {
    label: 'Overdue',
    textClass: 'text-red-700 font-semibold',
    Icon: AlertTriangle,
  },
  due_soon: {
    label: 'Due Soon',
    textClass: 'text-amber-700 font-semibold',
    Icon: Clock,
  },
  done: {
    label: 'Done',
    textClass: 'text-emerald-700 font-medium',
    Icon: CheckCircle2,
  },
  open: {
    label: 'On Track',
    textClass: 'text-slate-600 font-medium',
    Icon: null,
  },
  none: {
    label: 'No Due Date',
    textClass: 'text-slate-400',
    Icon: null,
  },
};

export function DeadlineBadge({ commitmentDate, finishedDate }: DeadlineBadgeProps) {
  const status = getDeadlineStatus(commitmentDate, finishedDate);
  const { label, textClass, Icon } = CONFIG[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${textClass}`}>
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}

export function getRowHighlightClass(status: DeadlineStatus): string {
  if (status === 'overdue') return 'bg-red-50/70 hover:bg-red-50';
  if (status === 'due_soon') return 'bg-amber-50/70 hover:bg-amber-50';
  if (status === 'done') return 'bg-emerald-50/50 hover:bg-emerald-50/80';
  return 'bg-white hover:bg-slate-50';
}
