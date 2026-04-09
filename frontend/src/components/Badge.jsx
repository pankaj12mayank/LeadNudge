const styles = {
  solid: "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black",
  outline: "border-neutral-400 bg-transparent text-neutral-800 dark:border-neutral-500 dark:text-neutral-200",
  muted: "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
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
