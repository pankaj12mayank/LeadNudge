const styles = {
  solid: "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black",
  outline: "border-neutral-400 bg-transparent text-neutral-800 dark:border-neutral-500 dark:text-neutral-200",
  muted: "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
  hot: "border-red-600 bg-red-50 text-red-800 dark:border-red-500 dark:bg-red-950/50 dark:text-red-200",
  warm: "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100",
  cold: "border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  pipelinePurple: "border-violet-600 bg-violet-600 text-white dark:border-violet-500 dark:bg-violet-600",
  pipelineBlue: "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600",
  pipelineBlueSoft: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-100",
  pipelineBrown: "border-amber-800 bg-amber-800 text-white dark:border-amber-700 dark:bg-amber-900",
  pipelineRose: "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-600 dark:bg-rose-950/50 dark:text-rose-100",
  pipelineSlate: "border-neutral-700 bg-neutral-700 text-white dark:border-neutral-600 dark:bg-neutral-800",
  pipelineNew: "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-600 dark:bg-rose-950/50 dark:text-rose-100",
  pipelineOld: "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-100",
  pipelineTeal: "border-teal-700 bg-teal-700 text-white dark:border-teal-600 dark:bg-teal-800",
  pipelineEmerald: "border-emerald-700 bg-emerald-700 text-white dark:border-emerald-600 dark:bg-emerald-800",
  pipelineFail: "border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-600",
  pipelineAmber: "border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-100",
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
