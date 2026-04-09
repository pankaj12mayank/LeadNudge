export default function Card({
  title,
  children,
  className = "",
  actions,
  noBodyPadding = false,
}) {
  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950 ${className}`}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-5 py-3 dark:border-neutral-700">
          {title && (
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      <div className={noBodyPadding ? "" : "p-5"}>{children}</div>
    </div>
  );
}
