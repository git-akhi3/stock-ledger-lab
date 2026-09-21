// Fleet-wide figures from the design document, at today's volume.

/** Today's replay pipelines, per month (~5.05B reads at $0.06 / 100k). */
export const OLD_USD = 3030
/** The new design, per month (reads, writes, tasks and the nightly sweep). */
export const NEW_USD = 50
/** Tasks per second a Cloud Tasks queue dispatches by default. */
export const QUEUE_LIMIT = 500

/** ~3M recomputes a month at 1×, peaking at about 10× the average rate. */
export function peakTasksPerSec(scale: number): number {
  return ((3_000_000 * scale) / 2_592_000) * 10
}
