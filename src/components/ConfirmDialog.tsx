import { useEffect, useId, useRef, type SyntheticEvent } from 'react';

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isPending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog = ({
  isOpen,
  title,
  description,
  confirmLabel,
  isPending,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onCancel();
  };

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={handleCancel}
    >
      <h2 id={titleId} className="dialog__title">
        {title}
      </h2>
      <p id={descriptionId}>{description}</p>
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog__actions">
        <button type="button" className="button" onClick={onCancel} disabled={isPending}>
          Отмена
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending ? 'Удаление…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
};
