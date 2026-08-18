/**
 * SimulationClock — deterministic accumulation of simulated time.
 *
 * Independent of Three.js and independent of the render loop, so it can be
 * unit-tested and driven by any scheduler (requestAnimationFrame, fixed tick,
 * or manual advance). The clock stores simulated seconds; a speed multiplier
 * and a pause flag wrap that value. Every advance is pure arithmetic so the
 * resulting time is fully deterministic for a given input history.
 *
 * Units: internal seconds. `timeDays` convenience exposes the value days-based
 * for orbital consumers (orbital periods are stored in days).
 */
export class SimulationClock {
  private _timeSec: number;
  private _speed: number;
  private _paused: boolean;

  /**
   * @param startSec  initial simulated time in seconds.
   * @param speed     initial speed multiplier (> 0). Must be finite.
   * @param paused    start paused?
   */
  constructor(startSec = 0, speed = 1, paused = false) {
    this._timeSec = startSec;
    this._speed = speed > 0 && Number.isFinite(speed) ? speed : 1;
    this._paused = paused;
  }

  /** Current simulated time in seconds. */
  get timeSec(): number {
    return this._timeSec;
  }

  /** Current simulated time in days (used by orbital simulation). */
  get timeDays(): number {
    return this._timeSec / 86_400;
  }

  get paused(): boolean {
    return this._paused;
  }

  get speed(): number {
    return this._speed;
  }

  /** Advance the clock by `dt` real seconds, honoring pause and speed. */
  advance(dtSeconds: number): number {
    if (this._paused) return this._timeSec;
    if (Number.isFinite(dtSeconds)) {
      this._timeSec += dtSeconds * this._speed;
    }
    return this._timeSec;
  }

  setSpeed(speed: number): void {
    if (speed > 0 && Number.isFinite(speed)) this._speed = speed;
  }

  setPaused(paused: boolean): void {
    this._paused = paused;
  }

  reset(timeSec = 0): void {
    this._timeSec = timeSec;
  }
}
