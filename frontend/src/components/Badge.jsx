const styles = {
  solid: "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black",
  outline: "border-neutral-400 bg-transparent text-neutral-800 dark:border-neutral-500 dark:text-neutral-200",
  muted: "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
  hot: "border-red-600 bg-red-50 text-red-800 dark:border-red-500 dark:bg-red-950/50 dark:text-red-200",
  warm: "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100",
  cold: "border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
};

export default function Badge({ children, variant = "muted", className = "" }) {
  const s = styles[variant] || styles.muted;
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${s} ${className}`}
    >
      {children}
    </span>
  );
}
