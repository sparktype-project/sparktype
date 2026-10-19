import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/core/components/ui/alert-dialog';

export interface ThemeImportReport {
  fileName: string;
  errors: string[];
  warnings: string[];
}

interface Props {
  report: ThemeImportReport | null;
  onClose: () => void;
}

function Reasons({ heading, items }: { heading: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold">{heading}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm break-words">
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function ThemeImportReportDialog({ report, onClose }: Props) {
  const blocked = (report?.errors.length ?? 0) > 0;

  return (
    <AlertDialog open={report !== null} onOpenChange={open => !open && onClose()}>
      <AlertDialogContent data-testid="theme-import-report">
        <AlertDialogHeader>
          <AlertDialogTitle>{blocked ? 'Theme import blocked' : 'Theme imported with warnings'}</AlertDialogTitle>
          <AlertDialogDescription>
            {blocked
              ? `"${report?.fileName}" was not imported because of the problems below.`
              : `"${report?.fileName}" was imported. Review these notes.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-72 space-y-4 overflow-y-auto">
          <Reasons heading="Problems" items={report?.errors ?? []} />
          <Reasons heading="Warnings" items={report?.warnings ?? []} />
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Close</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
