export default function LogoutConfirmModal({ open, onStay, onLogout }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        aria-label="Close"
        onClick={onStay}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-950"
      >
        <h2 id="logout-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Sign out?
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Do you want to sign out? You will need your email and password to sign back in.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onStay}>
            Stay signed in
          </button>
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={onLogout}>
            Yes, sign out
          </button>
        </div>
      </div>
    </div>
  );
}
