// src/features/editor/components/publish/PublishReport.tsx

import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { PrePublishFinding } from '@/core/services/publishing/checks/prePublishChecks';

interface PublishReportProps {
  findings: PrePublishFinding[];
  /** Called when a finding link is followed, so the dialog can get out of the way. */
  onNavigate: () => void;
}

interface GroupProps {
  title: string;
  findings: PrePublishFinding[];
  tone: 'blocking' | 'warning';
  onNavigate: () => void;
}

function FindingGroup({ title, findings, tone, onNavigate }: GroupProps) {
  if (findings.length === 0) return null;
  const Icon = tone === 'blocking' ? XCircle : AlertTriangle;
  const headingId = `publish-findings-${tone}`;

  return (
    <section role="region" aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="text-sm font-semibold">
        {title} ({findings.length})
      </h3>
      <ul className="space-y-2">
        {findings.map((finding) => (
          <li key={finding.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <Icon
              aria-hidden
              className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'blocking' ? 'text-destructive' : 'text-amber-600'}`}
            />
            <span className="flex-1">{finding.message}</span>
            <Link to={finding.fixHref} onClick={onNavigate} className="shrink-0 font-medium underline underline-offset-2">
              Fix<span className="sr-only"> {finding.path ?? 'site'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PublishReport({ findings, onNavigate }: PublishReportProps) {
  if (findings.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <CheckCircle2 aria-hidden className="h-4 w-4 text-green-600" />
        No problems found.
      </p>
    );
  }

  return (
    <div className="max-h-[50vh] space-y-4 overflow-y-auto">
      <FindingGroup
        title="Must fix before publishing"
        tone="blocking"
        findings={findings.filter((f) => f.severity === 'blocking')}
        onNavigate={onNavigate}
      />
      <FindingGroup
        title="Worth a look"
        tone="warning"
        findings={findings.filter((f) => f.severity === 'warning')}
        onNavigate={onNavigate}
      />
    </div>
  );
}
