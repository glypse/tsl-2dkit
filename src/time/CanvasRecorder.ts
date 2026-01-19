import {
	Output,
	BufferTarget,
	Mp4OutputFormat,
	WebMOutputFormat,
	CanvasSource
} from "mediabunny";
import type { TSLScene2D } from "../core";
import type { FixedTime } from "./fixedTime";

/** Configuration options for CanvasRecorder. */
export type CanvasRecorderOptions = {
	/**
	 * Target frames per second for the recording.
	 *
	 * @default 60
	 */
	fps?: number;

	/**
	 * Video bitrate in bits per second. Higher values = better quality but
	 * larger files.
	 *
	 * @default 25_000_000 (25 Mbps - near lossless for most content)
	 */
	videoBitsPerSecond?: number;

	/**
	 * Output format for the video.
	 *
	 * @default "mp4"
	 */
	format?: "mp4" | "webm";

	/**
	 * Video codec to use.
	 *
	 * @default "avc" for mp4, "vp9" for webm
	 */
	codec?: "avc" | "hevc" | "vp9" | "vp8" | "av1";

	/**
	 * Filename for the downloaded video (without extension).
	 *
	 * @default "recording"
	 */
	filename?: string;
};

type RecorderState = "inactive" | "recording";

/**
 * Records a canvas element to a video file with guaranteed fixed framerate.
 * Uses Mediabunny for frame-by-frame video encoding, ensuring exact FPS
 * regardless of browser throttling or performance issues.
 *
 * @example
 *
 * ```ts
 * const fixedTime = new FixedTime();
 * canvas.setFixedTime(fixedTime);
 *
 * // Use fixedTime.timeUniform in your shaders
 * await TSLScene2D.build(() => someShader(fixedTime.timeUniform));
 *
 * const recorder = new CanvasRecorder(canvas, fixedTime);
 *
 * // Option 1: Record with a fixed duration
 * await recorder.start({ duration: 5 }); // Records 5 seconds then stops
 *
 * // Option 2: Start/stop manually
 * recorder.start();
 * // ... later ...
 * await recorder.stop(); // Downloads the video
 * ```
 */
export class CanvasRecorder {
	private canvas2d: TSLScene2D;
	private fixedTime: FixedTime;
	private _state: RecorderState = "inactive";
	private options: Required<Omit<CanvasRecorderOptions, "codec">> & {
		codec?: CanvasRecorderOptions["codec"];
	};

	// Active recording state
	private output: Output | null = null;
	private videoSource: CanvasSource | null = null;
	private frameCount = 0;
	private stopRequested = false;
	private recordingPromise: Promise<Blob> | null = null;
	private recordingResolve: ((blob: Blob) => void) | null = null;

	/**
	 * Creates a new CanvasRecorder instance.
	 *
	 * @param canvas2d - The TSLScene2D instance to record
	 * @param fixedTime - The FixedTime instance controlling the animation
	 * @param options - Optional configuration for the recorder
	 */
	constructor(
		canvas2d: TSLScene2D,
		fixedTime: FixedTime,
		options: CanvasRecorderOptions = {}
	) {
		this.canvas2d = canvas2d;
		this.fixedTime = fixedTime;
		this.options = {
			fps: options.fps ?? 60,
			videoBitsPerSecond: options.videoBitsPerSecond ?? 25_000_000,
			format: options.format ?? "mp4",
			codec: options.codec,
			filename: options.filename ?? "recording"
		};
	}

	/**
	 * Get the current state of the recorder.
	 *
	 * @returns The current recorder state
	 */
	get state(): RecorderState {
		return this._state;
	}

	/**
	 * Check if recording is in progress.
	 *
	 * @returns True if currently recording, false otherwise
	 */
	get isRecording(): boolean {
		return this._state === "recording";
	}

	/**
	 * Update recorder options. Note: This only affects future recordings, not
	 * ongoing ones.
	 *
	 * @param options - Partial options to update
	 */
	setOptions(options: Partial<CanvasRecorderOptions>): void {
		Object.assign(this.options, options);
	}

	/**
	 * Start recording.
	 *
	 * If `duration` is provided, records for that many seconds then
	 * automatically stops and downloads the video. The returned promise
	 * resolves when complete.
	 *
	 * If `duration` is omitted, recording continues until `stop()` is called.
	 * In this case, the returned promise resolves immediately after setup.
	 *
	 * @param options - Optional recording options
	 * @param options.duration - Duration of the recording in seconds
	 * @param options.filename - {@link CanvasRecorderOptions.filename}
	 * @returns Promise that resolves with the Blob (for fixed duration) or void
	 *   (for manual stop)
	 */
	start(options?: {
		duration?: number;
		filename?: string;
	}): Promise<Blob | undefined> {
		if (this._state === "recording") {
			console.warn("CanvasRecorder: Already recording");
			return Promise.resolve(undefined);
		}

		const duration = options?.duration;
		const filename = options?.filename ?? this.options.filename;

		if (duration !== undefined && duration <= 0) {
			return Promise.reject(
				new Error(
					"CanvasRecorder: duration must be positive if specified"
				)
			);
		}

		return this.startRecording(duration, filename);
	}

	/**
	 * Stop recording and download the video. Only needed when recording without
	 * a fixed duration.
	 *
	 * @returns Promise that resolves with the recorded Blob
	 */
	async stop(): Promise<Blob> {
		if (this._state !== "recording") {
			throw new Error("CanvasRecorder: Not currently recording");
		}

		// Signal the recording loop to stop
		this.stopRequested = true;

		// Wait for the recording to complete
		if (this.recordingPromise) {
			return this.recordingPromise;
		}

		throw new Error("CanvasRecorder: Recording promise not available");
	}

	/** Cancel the recording without saving. */
	cancel(): void {
		if (this._state === "recording") {
			this.stopRequested = true;
			// The recording loop will handle cleanup
			console.log("CanvasRecorder: Recording cancelled");
		}
	}

	private async startRecording(
		duration: number | undefined,
		filename: string
	): Promise<Blob | undefined> {
		const fps = this.options.fps;
		const format = this.options.format;
		const totalFrames =
			duration !== undefined ? Math.ceil(duration * fps) : undefined;
		const frameDuration = 1 / fps;

		// Stop the real-time animation loop
		this.canvas2d.stopAnimationLoop();

		// Reset and configure fixed time
		this.fixedTime.reset();
		this.fixedTime.targetFps = fps;
		this.fixedTime.enableFixedMode(fps);

		this._state = "recording";
		this.frameCount = 0;
		this.stopRequested = false;

		// Set up Mediabunny output
		const outputFormat =
			format === "webm" ? new WebMOutputFormat() : new Mp4OutputFormat();

		this.output = new Output({
			format: outputFormat,
			target: new BufferTarget()
		});

		// Determine codec
		const codec = this.options.codec ?? (format === "webm" ? "vp9" : "avc");

		// Create a CanvasSource for the video track
		this.videoSource = new CanvasSource(this.canvas2d.canvasElement, {
			codec,
			bitrate: this.options.videoBitsPerSecond
		});

		this.output.addVideoTrack(this.videoSource, { frameRate: fps });

		await this.output.start();

		// Create a promise that will resolve when recording is complete
		this.recordingPromise = new Promise<Blob>((resolve) => {
			this.recordingResolve = resolve;
		});

		// Start the recording loop
		const recordLoop = async (): Promise<Blob> => {
			try {
				while (!this.stopRequested) {
					// Check if we've reached the target duration
					if (
						totalFrames !== undefined &&
						this.frameCount >= totalFrames
					) {
						break;
					}

					// Set exact time for this frame
					this.fixedTime.setTime(this.frameCount * frameDuration);

					// Render the frame
					await this.canvas2d.renderFrame();

					// Add the frame to the video with exact timestamp
					const timestamp = this.frameCount * frameDuration;
					if (this.videoSource) {
						await this.videoSource.add(timestamp, frameDuration);
					}

					this.frameCount++;

					// Yield to prevent blocking
					if (this.frameCount % 10 === 0) {
						await new Promise((r) => {
							setTimeout(r, 0);
						});
					}
				}

				// Finalize the output
				if (!this.output) {
					throw new Error("CanvasRecorder: Output not available");
				}
				await this.output.finalize();

				// Get the buffer from the target
				const target = this.output.target as BufferTarget;
				const buffer = target.buffer;
				if (!buffer) {
					throw new Error(
						"CanvasRecorder: No buffer available after finalization"
					);
				}

				const mimeType = format === "webm" ? "video/webm" : "video/mp4";
				const blob = new Blob([buffer], { type: mimeType });

				// Download the file (only if not cancelled)
				if (!this.stopRequested || this.frameCount > 0) {
					this.downloadBlob(blob, filename, format);
				}

				// Cleanup
				this.cleanup();

				// Resolve the promise
				if (this.recordingResolve) {
					this.recordingResolve(blob);
				}

				return blob;
			} catch (error) {
				this.cleanup();
				throw error;
			}
		};

		// For fixed duration, wait for completion
		if (duration !== undefined) {
			return recordLoop();
		}

		// For manual stop, start the loop but don't wait
		void recordLoop();
		return Promise.resolve(undefined);
	}

	private cleanup(): void {
		this._state = "inactive";
		this.fixedTime.disableFixedMode();
		this.canvas2d.resumeAnimationLoop();
		this.output = null;
		this.videoSource = null;
		this.recordingPromise = null;
		this.recordingResolve = null;
	}

	private downloadBlob(
		blob: Blob,
		filename: string,
		format: "mp4" | "webm"
	): void {
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${filename}.${format}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		setTimeout(() => {
			URL.revokeObjectURL(url);
		}, 1000);
	}

	/**
	 * Dispose of all resources held by the recorder. This stops any ongoing
	 * recording and cleans up mediabunny resources to prevent memory leaks.
	 */
	dispose(): void {
		// Stop any ongoing recording
		if (this._state === "recording") {
			this.cancel();
		}

		// Dispose mediabunny resources
		if (this.output) {
			// Check if Output has a dispose method
			if (
				"dispose" in this.output &&
				typeof this.output.dispose === "function"
			) {
				(this.output.dispose as () => void)();
			}
			this.output = null;
		}

		if (this.videoSource) {
			// Check if CanvasSource has a dispose method
			if (
				"dispose" in this.videoSource &&
				typeof this.videoSource.dispose === "function"
			) {
				(this.videoSource.dispose as () => void)();
			}
			this.videoSource = null;
		}

		// Clear all references
		this.recordingPromise = null;
		this.recordingResolve = null;
	}
}
