import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface ConfirmDeleteDetailRow {
  label: string;
  value: string;
}

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  itemName: string;
  details?: ConfirmDeleteDetailRow[];
  warningText?: string;
  confirmLabel?: string;
  isDeleting?: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  description,
  itemName,
  details = [],
  warningText,
  confirmLabel = 'Ya, Hapus Data',
  isDeleting = false,
  errorMessage = null,
  onCancel,
  onConfirm,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-confirm-delete-title"
      className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white border border-stone-200 rounded-lg max-w-md w-full p-6 space-y-5 shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-red-50 border border-red-200 text-red-700 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="modal-confirm-delete-title"
                className="text-base font-bold text-stone-900"
              >
                {title}
              </h2>
              <p className="text-sm text-stone-600 mt-0.5">{description}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            aria-label="Tutup konfirmasi hapus"
            className="p-1 text-stone-400 hover:text-stone-700 rounded disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-stone-50 border border-stone-200 rounded-md p-4 space-y-2 text-sm">
          <div className="font-semibold text-stone-900 break-words">
            {itemName}
          </div>
          {details.length > 0 && (
            <dl className="space-y-1 text-xs text-stone-600 pt-1 border-t border-stone-200">
              {details.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-3"
                >
                  <dt className="text-stone-500 shrink-0">{row.label}</dt>
                  <dd className="font-medium text-stone-800 text-right break-words">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {warningText && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 leading-relaxed">
            {warningText}
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-stone-700 bg-stone-100 border border-stone-300 rounded-md hover:bg-stone-200 disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => void onConfirm()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-700 rounded-md hover:bg-red-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>{isDeleting ? 'Menghapus...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
