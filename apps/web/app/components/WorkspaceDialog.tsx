"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Workspace.module.css";

/** Native modal semantics keep focus and keyboard navigation inside the overlay. */
export function WorkspaceDialog({
  title,
  closeLabel,
  initialFocusId,
  open = true,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  initialFocusId?: string;
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previous = document.activeElement;
    if (!element) return;
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
    return () => {
      if (typeof element.close === "function") element.close();
      else element.removeAttribute("open");
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !initialFocusId) return;
    const target = document.getElementById(initialFocusId);
    if (target && dialog.current?.contains(target)) target.focus();
  }, [open, initialFocusId]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label={title}
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button, a[href], input, select, textarea, summary, [tabindex]",
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(':disabled, [aria-disabled="true"]') &&
            element.getClientRects().length > 0,
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <div className={styles.dialogHeader}>
        <h2>{title}</h2>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={closeLabel}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
