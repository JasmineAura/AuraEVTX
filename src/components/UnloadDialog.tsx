import { useEffect, useRef } from "react";
import type { SourceFile } from "../types";

export default function UnloadDialog({
  file,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  file: SourceFile;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="unload-dialog"
      aria-labelledby="unload-title"
      aria-describedby="unload-description"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <span className="eyebrow">WORKSPACE / UNLOAD</span>
      <h2 id="unload-title">卸载日志？</h2>
      <strong className="unload-filename">{file.name}</strong>
      <p id="unload-description">
        从工作区移除该日志及其 {file.count.toLocaleString()}{" "}
        条事件，相关收藏也会清除。原始 EVTX 文件会保留，可随时重新导入。
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="unload-dialog-actions">
        <button
          className="small-button"
          autoFocus
          disabled={busy}
          onClick={onClose}
        >
          取消
        </button>
        <button className="primary-button" disabled={busy} onClick={onConfirm}>
          {busy ? "正在卸载…" : "确认卸载"}
        </button>
      </div>
    </dialog>
  );
}
