interface StudentInfoItemProps {
  label: string;
  value?: string | null;
}

export function StudentInfoItem({ label, value }: StudentInfoItemProps) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>

      <p className="text-base font-medium wrap-break-word">
        {value?.trim() || "—"}
      </p>
    </div>
  );
}