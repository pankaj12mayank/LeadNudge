export default function Table({ columns, rows, emptyText = "No data" }) {
  if (!rows?.length) {
    return (
      <p className="rounded-md border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-600 dark:text-neutral-400">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-700">
      <table className="min-w-full divide-y divide-neutral-200 text-left text-sm dark:divide-neutral-700">
        <thead className="bg-neutral-50 dark:bg-neutral-900">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 font-semibold text-neutral-800 dark:text-neutral-200"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
