import { useCallback, useState } from "react";
import { toast } from "sonner";

export default function SupportEmailDialog({ open, onClose, email }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    const t = (email || "").trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setCopied(true);
      toast.success("Email copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the address and copy manually.");
    }
  }, [email]);

  if (!open || !email) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-950"
        role="dialog"
        aria-labelledby="support-dialog-title"
      >
        <h2
          id="support-dialog-title"
          className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
        >
          Support
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Copy this address and paste it into your email app (To / CC) to contact support.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-900">
          <span className="min-w-0 flex-1 break-all text-neutral-900 dark:text-neutral-100">
            {email}
          </span>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-900"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            onClick={copy}
          >
            {copied ? "Copied" : "Copy email"}
          </button>
        </div>
      </div>
    </div>
  );
}
