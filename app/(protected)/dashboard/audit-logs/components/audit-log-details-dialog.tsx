"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuditLogDetail } from "@/hooks/audit.hook";
import { displayValue, formatDateTime, formatFullName } from "@/lib/format";

interface AuditLogDetailsDialogProps {
  auditLogId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogDetailsDialog({
  auditLogId,
  open,
  onOpenChange,
}: AuditLogDetailsDialogProps) {
  const { data: auditLog, isLoading, isError } = useAuditLogDetail(
    open ? auditLogId : null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl! overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Audit Log Details</DialogTitle>
          <DialogDescription>
            Read-only record of the recorded system activity.
          </DialogDescription>
        </DialogHeader>
        {isLoading && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading audit record...
          </p>
        )}
        {isError && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Unable to load this audit record.
          </p>
        )}
        {auditLog && (
          <div className="space-y-6">
            <section className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                {auditLog.module} / {auditLog.action}
              </p>
              <p className="mt-1 text-base font-medium">{auditLog.description}</p>
            </section>

            <DetailGrid>
              <DetailItem label="Timestamp" value={formatDateTime(auditLog.createdAt)} />
              <DetailItem
                label="Actor"
                value={formatFullName(
                  auditLog.actorFirstName,
                  auditLog.actorMiddleName,
                  auditLog.actorLastName,
                )}
              />
              <DetailItem label="Module" value={auditLog.module} />
              <DetailItem label="Action" value={auditLog.action} />
              <CopyableDetailItem label="Audit ID" value={auditLog.id} />
              <CopyableDetailItem label="Record ID" value={auditLog.recordId} />
              <DetailItem label="Record Name" value={auditLog.recordName} />
              <DetailItem label="Actor Username" value={auditLog.actorUsername} />
              <DetailItem
                label="Actor Employee Number"
                value={auditLog.actorEmployeeNumber}
              />
              <DetailItem label="Actor ID" value={auditLog.actorId} />
            </DetailGrid>

            <MetadataSection metadata={auditLog.metadata} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="break-words">{displayValue(value)}</p>
    </div>
  );
}

function CopyableDetailItem({
  label,
  value,
}: {
  label: "Audit ID" | "Record ID";
  value: string | null;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 break-all font-mono text-sm">
          {displayValue(value)}
        </p>
        <CopyButton
          value={value}
          label={`Copy ${label}`}
          successMessage={`${label} copied.`}
        />
      </div>
    </div>
  );
}

function MetadataSection({ metadata }: { metadata: unknown }) {
  const metadataObject = isRecord(metadata) ? metadata : null;
  const changes = metadataObject?.changes;
  const remainingMetadata = metadataObject
    ? Object.fromEntries(
        Object.entries(metadataObject).filter(([key]) => key !== "changes"),
      )
    : metadata;
  const hasRemainingMetadata =
    isRecord(remainingMetadata)
      ? Object.keys(remainingMetadata).length > 0
      : remainingMetadata !== null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Audit Metadata</h2>
        <CopyButton
          value={metadata === null ? null : JSON.stringify(metadata, null, 2)}
          label="Copy Metadata (JSON)"
          successMessage="Audit metadata copied."
        />
      </div>
      {changes !== undefined && (
        <MetadataBlock title="Changed Fields" value={changes} />
      )}
      {hasRemainingMetadata ? (
        <MetadataBlock title="Additional Metadata" value={remainingMetadata} />
      ) : changes === undefined ? (
        <p className="text-sm text-muted-foreground">No metadata was recorded.</p>
      ) : null}
    </section>
  );
}

function MetadataBlock({ title, value }: { title: string; value: unknown }) {
  const isLarge =
    (Array.isArray(value) && value.length > 4) ||
    (isRecord(value) && Object.keys(value).length > 4);

  if (isLarge) {
    return (
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">{title}</summary>
        <div className="mt-4">
          <MetadataValue value={value} collapseLarge={false} />
        </div>
      </details>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium">{title}</h3>
      <div className="mt-4">
        <MetadataValue value={value} collapseLarge={false} />
      </div>
    </div>
  );
}

function MetadataValue({
  value,
  collapseLarge = true,
}: {
  value: unknown;
  collapseLarge?: boolean;
}) {
  if (value === null || value === undefined) {
    return <p className="text-sm text-muted-foreground">None</p>;
  }

  if (Array.isArray(value)) {
    if (collapseLarge && value.length > 4) {
      return (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            {value.length} items
          </summary>
          <div className="mt-3">
            <MetadataValue value={value} collapseLarge={false} />
          </div>
        </details>
      );
    }

    return (
      <ol className="space-y-3">
        {value.map((item, index) => (
          <li key={index} className="rounded-md bg-muted/50 p-3">
            <MetadataValue value={item} />
          </li>
        ))}
      </ol>
    );
  }

  if (isRecord(value)) {
    if (collapseLarge && Object.keys(value).length > 4) {
      return (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            {Object.keys(value).length} fields
          </summary>
          <div className="mt-3">
            <MetadataValue value={value} collapseLarge={false} />
          </div>
        </details>
      );
    }

    return (
      <dl className="space-y-3">
        {Object.entries(value).map(([key, nestedValue]) => (
          <div key={key} className="space-y-1">
            <dt className="text-sm font-medium text-muted-foreground">
              {formatMetadataKey(key)}
            </dt>
            <dd className="rounded-md bg-muted/50 p-3">
              <MetadataValue value={nestedValue} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return <p className="break-words text-sm">{String(value)}</p>;
}

function CopyButton({
  value,
  label,
  successMessage,
}: {
  value: string | null;
  label: string;
  successMessage: string;
}) {
  async function copyValue() {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Unable to copy to the clipboard.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void copyValue()}
      disabled={!value}
    >
      <Copy />
      {label}
    </Button>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatMetadataKey(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}
