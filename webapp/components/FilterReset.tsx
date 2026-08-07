/**
 * One reset control, used by every filterable screen.
 *
 * Reset existed only on the vacancy browser, so on a dashboard or an admin list
 * the way out of a filter that matched nothing was to remember what you had
 * changed and undo each control. It disables itself when nothing is filtered, so
 * it never claims there is something to clear when there isn't.
 */
export function FilterReset({ onReset, active, label = "Reset filters" }: {
  onReset: () => void;
  /** True when at least one filter is away from its default. */
  active: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="reset-admin-filters"
      onClick={onReset}
      disabled={!active}
      title={active ? label : "No filters applied"}
    >
      ↺ {label}
    </button>
  );
}
