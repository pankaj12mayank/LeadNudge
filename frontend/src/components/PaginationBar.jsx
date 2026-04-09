export default function PaginationBar({
  page,
  pages,
  total,
  limit,
  onPageChange,
  disabled,
}) {
  if (total === 0) return null;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Showing <span className="tabular-nums">{from}</span>–
        <span className="tabular-nums">{to}</span> of{" "}
        <span className="tabular-nums">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
          Page {page} / {pages}
        </span>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-sm"
          disabled={disabled || page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
