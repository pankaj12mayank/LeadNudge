import { useLayoutEffect, useRef } from "react";

function syncFromDom(el, onChange) {
  if (el) onChange(el.innerHTML || "");
}

export default function ResetEmailHtmlEditor({ value, onChange, disabled }) {
  const ref = useRef(null);
  const typing = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typing.current) {
      typing.current = false;
      return;
    }
    const next = value || "";
    if (el.innerHTML !== next) {
      el.innerHTML = next;
    }
  }, [value]);

  function run(cmd, arg = null) {
    const el = ref.current;
    if (!el || disabled) return;
    el.focus();
    try {
      document.execCommand(cmd, false, arg);
    } catch {
      /* ignore */
    }
    typing.current = true;
    syncFromDom(el, onChange);
  }

  function insertParagraph() {
    run("formatBlock", "p");
  }

  function onImagePick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const url = reader.result;
      document.execCommand(
        "insertHTML",
        false,
        `<img src="${url}" alt="" style="max-width:100%;height:auto;" />`,
      );
      typing.current = true;
      syncFromDom(el, onChange);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium dark:border-neutral-600 dark:bg-neutral-900"
          disabled={disabled}
          onClick={() => run("bold")}
        >
          Bold
        </button>
        <button
          type="button"
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium dark:border-neutral-600 dark:bg-neutral-900"
          disabled={disabled}
          onClick={() => run("italic")}
        >
          Italic
        </button>
        <button
          type="button"
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium dark:border-neutral-600 dark:bg-neutral-900"
          disabled={disabled}
          onClick={() => run("underline")}
        >
          Underline
        </button>
        <button
          type="button"
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium dark:border-neutral-600 dark:bg-neutral-900"
          disabled={disabled}
          onClick={insertParagraph}
        >
          Paragraph
        </button>
        <label className="cursor-pointer rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium dark:border-neutral-600 dark:bg-neutral-900">
          Image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled}
            onChange={onImagePick}
          />
        </label>
      </div>
      <div
        ref={ref}
        className="form-input min-h-[180px] overflow-auto rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={(e) => {
          typing.current = true;
          onChange(e.currentTarget.innerHTML);
        }}
        onBlur={(e) => onChange(e.currentTarget.innerHTML)}
      />
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Stored as HTML. Placeholders:{" "}
        <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
          {"{{reset_link}}"}
        </code>
        ,{" "}
        <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
          {"{{user_name}}"}
        </code>
        .
      </p>
    </div>
  );
}
