import React, { useEffect } from "react";

type Props = {
  open: boolean;
  message: string | null;
  duration?: number; // ms
  onClose: () => void;
};

const ActionOverlay: React.FC<Props> = ({
  open,
  message,
  duration = 2500,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onClose(), duration);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, duration, onClose]);

  if (!open || !message) return null;

  return (
    <div className="action-overlay" role="status" aria-live="assertive">
      <div className="action-overlay__box">
        <div className="action-overlay__text">{message}</div>
      </div>
    </div>
  );
};

export default ActionOverlay;
