"use client";

interface ConfirmModalProps {
  title: string;
  description: string;
  open: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  rows: Array<{ label: string; value: string }>;
}

export default function ConfirmModal({
  title,
  description,
  open,
  confirmLabel,
  onConfirm,
  onClose,
  loading,
  rows,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="surface w-full max-w-xl p-6">
        <h3 className="text-3xl">{title}</h3>
        <p className="mt-2 text-xs text-[#6b6560]">{description}</p>

        <div className="mt-5 space-y-2 border border-[#1e1e1e] p-4">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 text-xs">
              <span className="text-[#6b6560]">{row.label}</span>
              <span className="font-mono text-right">{row.value}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[11px] text-[#6b6560]">
          Estimated chain cost depends on rent and network load.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button className="button-outline rounded-[4px] px-4 py-2 text-xs" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="button-gold rounded-[4px] px-4 py-2 text-xs" onClick={onConfirm} disabled={loading}>
            {loading ? "Sealing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
