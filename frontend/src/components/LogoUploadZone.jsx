import { useCallback, useId, useState } from "react";

const ACCEPT = ".png,.jpg,.jpeg,.svg,.webp";

export default function LogoUploadZone({ disabled, onFile, hint }) {
  const id = useId();
  const [dragOver, setDragOver] = useState(false);
  const [lastName, setLastName] = useState("");

  const handleFile = useCallback(
    (file) => {
      if (!file || disabled) return;
      setLastName(file.name);
      onFile(file);
    },
    [disabled, onFile]
  );

  return (
    <div>
      <span className="form-label">Logo</span>
      <div
        className={`mt-1 rounded-lg border-2 border-dashed px-4 py-8 text-center transition ${
          dragOver
            ? "border-neutral-900 bg-neutral-100 dark:border-white dark:bg-neutral-900"
            : "border-neutral-300 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-950"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
      >
        <input
          id={id}
          type="file"
          accept={ACCEPT}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Drop an image here, or
        </p>
        <label
          htmlFor={id}
          className={`mt-3 inline-flex cursor-pointer rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 ${
            disabled ? "pointer-events-none opacity-50" : ""
          }`}
        >
          Choose file
        </label>
        {lastName ? (
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            Last selected: <span className="font-medium text-neutral-800 dark:text-neutral-200">{lastName}</span>
          </p>
        ) : null}
        {hint ? (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
