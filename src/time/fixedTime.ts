import { renderGroup, uniform } from "three/tsl";

/**
 * A controllable time uniform that can operate in real-time or fixed-step mode.
 * In fixed-step mode, time advances by a consistent delta on each frame, which
 * is ideal for recordings where you want perfect frame timing.
 */
export class FixedTime {
	private _time = 0;
	private _deltaTime = 0;
	private _targetFps = 60;
	private _fixedMode = false;
	private _paused = false;
	private _lastRealTime: number | null = null;

	/**
	 * TSL uniform for elapsed time (in seconds). Use this in shaders instead of
	 * the default `time` from three/tsl when you want controllable time.
	 */
	readonly timeUniform = uniform(0)
		.setGroup(renderGroup)
		.onRenderUpdate(() => this._time);

	/** TSL uniform for delta time (in seconds). */
	readonly deltaTimeUniform = uniform(0)
		.setGroup(renderGroup)
		.onRenderUpdate(() => this._deltaTime);

	/** Get the current elapsed time in seconds. */
	get time(): number {
		return this._time;
	}

	/** Get the current delta time in seconds. */
	get deltaTime(): number {
		return this._deltaTime;
	}

	/** Get the target FPS for fixed-step mode. */
	get targetFps(): number {
		return this._targetFps;
	}

	/** Set the target FPS for fixed-step mode. */
	set targetFps(fps: number) {
		this._targetFps = fps;
	}

	/** Check if time is in fixed-step mode. */
	get isFixedMode(): boolean {
		return this._fixedMode;
	}

	/** Check if time is paused. */
	get isPaused(): boolean {
		return this._paused;
	}

	/**
	 * Enable fixed-step mode where each frame advances by exactly 1/targetFps
	 * seconds. This is useful for recordings to ensure consistent frame
	 * timing.
	 */
	enableFixedMode(targetFps = 60): void {
		this._targetFps = targetFps;
		this._fixedMode = true;
		this._lastRealTime = null;
	}

	/** Disable fixed-step mode and return to real-time updates. */
	disableFixedMode(): void {
		this._fixedMode = false;
		this._lastRealTime = null;
	}

	/** Pause time updates. */
	pause(): void {
		this._paused = true;
		this._lastRealTime = null;
	}

	/** Resume time updates. */
	resume(): void {
		this._paused = false;
		this._lastRealTime = null;
	}

	/** Reset time to zero. */
	reset(): void {
		this._time = 0;
		this._deltaTime = 0;
		this._lastRealTime = null;
	}

	/** Set time to a specific value. */
	setTime(time: number): void {
		this._time = time;
	}

	/**
	 * Update time. Call this once per frame. In fixed mode, advances by
	 * 1/targetFps. In real-time mode, uses actual elapsed time.
	 */
	update(): void {
		if (this._paused) {
			this._deltaTime = 0;
			return;
		}

		if (this._fixedMode) {
			this._deltaTime = 1 / this._targetFps;
			this._time += this._deltaTime;
		} else {
			const now = performance.now() / 1000;
			if (this._lastRealTime === null) {
				this._deltaTime = 0;
			} else {
				this._deltaTime = now - this._lastRealTime;
			}
			this._lastRealTime = now;
			this._time += this._deltaTime;
		}
	}

	/**
	 * Manually step forward by one frame (1/targetFps seconds). Useful for
	 * manual frame-by-frame rendering.
	 */
	step(): void {
		this._deltaTime = 1 / this._targetFps;
		this._time += this._deltaTime;
	}
}

/** Default shared FixedTime instance for convenience. */
export const fixedTime = new FixedTime();
