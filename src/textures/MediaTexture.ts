import { texture, vec4, vec2, uniform, select, uv, float } from "three/tsl";
import {
	type Node,
	type UniformNode,
	Texture,
	type TextureNode,
	VideoTexture,
	LinearFilter,
	SRGBColorSpace
} from "three/webgpu";
import { TSLScene2D } from "../core";
import { UpdatableTexture } from "./UpdatableTexture";
import { wrapUV } from "../utils";

/** Configuration options for MediaTexture initialization. */
export type MediaTextureOptions = {
	src: string | HTMLImageElement | HTMLVideoElement;
	anchorX: "left" | "center" | "right";
	anchorY: "top" | "center" | "bottom";
	debug: boolean;
	autoplay: boolean;
	loop: boolean;
	muted: boolean;
};

/**
 * A texture that displays images or videos. Supports loading from URLs or
 * existing HTMLImageElement/HTMLVideoElement instances. Videos can be
 * controlled with play/pause/seek methods.
 */
export class MediaTexture extends UpdatableTexture {
	parameters: MediaTextureOptions;

	private _widthUniform = uniform(0);
	private _heightUniform = uniform(0);
	private _aspectUniform = uniform(1);
	private anchorOffsetXUniform = uniform(0.5);
	private anchorOffsetYUniform = uniform(0.5);
	private debugUniform = uniform(0);
	private debugLineWidthX = uniform(0);
	private debugLineWidthY = uniform(0);

	private mediaElement: HTMLImageElement | HTMLVideoElement;
	private textureNode: TextureNode | null = null;
	private isLoaded = false;
	private isVideo = false;
	private requestVideoFrameCallbackId = 0;

	/**
	 * Creates a new MediaTexture from an image or video source.
	 *
	 * @param parameters - Configuration options including the media source
	 */
	constructor(
		parameters: Partial<MediaTextureOptions> & {
			src: string | HTMLImageElement | HTMLVideoElement;
		}
	) {
		// Create initial 1x1 transparent placeholder texture to avoid null errors
		const canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.clearRect(0, 0, 1, 1);
		}

		const initialTexture = new Texture(canvas);
		initialTexture.generateMipmaps = false;
		initialTexture.minFilter = LinearFilter;
		initialTexture.magFilter = LinearFilter;
		initialTexture.needsUpdate = true;

		super(initialTexture);

		console.debug(
			"[MediaTexture] Constructor called with src:",
			typeof parameters.src === "string"
				? parameters.src
				: parameters.src.tagName
		);

		this.parameters = {
			src: parameters.src,
			anchorX: parameters.anchorX ?? "center",
			anchorY: parameters.anchorY ?? "center",
			debug: parameters.debug ?? false,
			autoplay: parameters.autoplay ?? true,
			loop: parameters.loop ?? true,
			muted: parameters.muted ?? true
		};

		// Determine if source is video
		if (typeof parameters.src === "string") {
			// Check file extension
			const ext = parameters.src.toLowerCase().split(".").pop();
			this.isVideo = ["mp4", "webm", "ogg", "mov"].includes(ext ?? "");
			console.debug(
				"[MediaTexture] Source type determined from extension:",
				ext,
				"isVideo:",
				this.isVideo
			);
		} else {
			this.isVideo = parameters.src instanceof HTMLVideoElement;
			console.debug(
				"[MediaTexture] Source type determined from element:",
				parameters.src.tagName,
				"isVideo:",
				this.isVideo
			);
		}

		// Load media
		if (typeof parameters.src === "string") {
			if (this.isVideo) {
				this.mediaElement = this.createVideoElement(parameters.src);
			} else {
				this.mediaElement = this.createImageElement(parameters.src);
			}
		} else {
			this.mediaElement = parameters.src;
			if (this.isVideo && parameters.src instanceof HTMLVideoElement) {
				const videoElement = parameters.src;
				// Check if video is already ready
				if (
					videoElement.readyState >=
					HTMLMediaElement.HAVE_CURRENT_DATA
				) {
					console.debug(
						"[MediaTexture] Video element already has data, setting up immediately"
					);
					this.setupVideoElement(videoElement);
					this.isLoaded = true;
					this.markReady();
				} else {
					console.debug(
						"[MediaTexture] Video element not ready, waiting for canplay event"
					);
					videoElement.addEventListener(
						"canplay",
						() => {
							if (!this.isLoaded) {
								this.setupVideoElement(videoElement);
								this.isLoaded = true;
								this.needsUpdate = true;
								this.markReady();
							}
						},
						{ once: true }
					);
				}
			} else if (parameters.src instanceof HTMLImageElement) {
				const imageElement = parameters.src;
				// Check if image is already loaded
				if (imageElement.complete && imageElement.naturalWidth > 0) {
					console.debug(
						"[MediaTexture] Image element already loaded, setting up immediately"
					);
					this.setupImageElement(imageElement);
					this.isLoaded = true;
					this.markReady();
				} else {
					console.debug(
						"[MediaTexture] Image element not loaded, waiting for load event"
					);
					imageElement.addEventListener(
						"load",
						() => {
							if (!this.isLoaded) {
								this.setupImageElement(imageElement);
								this.isLoaded = true;
								this.needsUpdate = true;
								this.markReady();
							}
						},
						{ once: true }
					);
				}
			} else {
				this.isLoaded = true;
				this.markReady();
			}
		}
	}

	private createImageElement(src: string): HTMLImageElement {
		console.debug("[MediaTexture] Creating image element for:", src);
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			console.debug(
				"[MediaTexture] Image loaded:",
				src,
				"dimensions:",
				img.naturalWidth,
				"x",
				img.naturalHeight
			);
			this.setupImageElement(img);
			this.isLoaded = true;
			this.needsUpdate = true;
			this.markReady();
		};
		img.onerror = (error: unknown) => {
			console.error("[MediaTexture] Failed to load image:", src, error);
		};
		img.src = src;
		return img;
	}

	private setupImageElement(image: HTMLImageElement): void {
		console.debug("[MediaTexture] Setting up image element");

		// Replace placeholder with proper Texture for the image
		this._texture.dispose();
		const imageTexture = new Texture(image);
		imageTexture.generateMipmaps = false;
		imageTexture.colorSpace = SRGBColorSpace; // Required for WebGPU
		imageTexture.needsUpdate = true;

		// Update the TextureNode's value to point to new texture
		// This allows the node graph to use the new texture without rebuilding
		if (this.textureNode) {
			this.textureNode.value = imageTexture;
		}

		this._texture = imageTexture;
		this.applyInterpolation();

		console.debug(
			"[MediaTexture] Replaced with Image Texture, colorSpace set to SRGB"
		);
	}

	private createVideoElement(src: string): HTMLVideoElement {
		console.debug("[MediaTexture] Creating video element for:", src);
		const video = document.createElement("video");
		video.crossOrigin = "anonymous";
		video.playsInline = true;
		video.autoplay = this.parameters.autoplay;
		video.loop = this.parameters.loop;
		video.muted = this.parameters.muted;

		video.addEventListener("loadedmetadata", () => {
			console.debug(
				"[MediaTexture] Video metadata loaded:",
				src,
				"dimensions:",
				video.videoWidth,
				"x",
				video.videoHeight
			);
		});

		video.addEventListener("canplay", () => {
			console.debug("[MediaTexture] Video can play:", src);

			// Only setup VideoTexture once video is ready to provide frames
			if (!this.isLoaded) {
				this.setupVideoElement(video);
				this.isLoaded = true;
				this.needsUpdate = true;
				this.markReady();
			}

			if (this.parameters.autoplay) {
				video.play().catch((err: unknown) => {
					console.error(
						"[MediaTexture] Failed to autoplay video:",
						err
					);
				});
			}
		});

		video.addEventListener("error", () => {
			const error = video.error;
			const errorMessage = error
				? `Code: ${String(error.code)}, Message: ${error.message}`
				: "Unknown error";
			console.error("[MediaTexture] Video error:", src, errorMessage);
		});

		video.src = src;
		video.load();

		return video;
	}

	private setupVideoElement(video: HTMLVideoElement): void {
		console.debug("[MediaTexture] Setting up video element callbacks");

		// Setup video frame callback for efficient updates
		console.debug(
			"[MediaTexture] Using requestVideoFrameCallback for video updates"
		);
		const updateVideo = (): void => {
			this.needsUpdate = true;
			this.requestVideoFrameCallbackId =
				video.requestVideoFrameCallback(updateVideo);
		};
		this.requestVideoFrameCallbackId =
			video.requestVideoFrameCallback(updateVideo);

		// Replace texture with VideoTexture for proper handling
		this._texture.dispose();
		const videoTexture = new VideoTexture(video);
		videoTexture.generateMipmaps = false;
		videoTexture.colorSpace = SRGBColorSpace; // Required for WebGPU

		// Update the TextureNode's value to point to new texture
		// This allows the node graph to use the new texture without rebuilding
		if (this.textureNode) {
			this.textureNode.value = videoTexture;
		}

		this._texture = videoTexture;
		this.applyInterpolation();

		console.debug(
			"[MediaTexture] Replaced with VideoTexture, colorSpace set to SRGB"
		);
	}

	/**
	 * Sample this texture using provided UVs. Registers with the active scene
	 * for per-frame updates.
	 *
	 * @param inputUV - Optional UV coordinates to sample at (defaults to
	 *   standard UVs)
	 * @returns A node containing the sampled color value
	 */
	sample(inputUV?: Node): Node {
		const canvas = TSLScene2D.currentScene;

		// Register for per-frame updates once sampling is requested
		canvas.registerUpdatableTexture(this);

		const rawUV = inputUV ?? uv();
		return this.sampleTexture(rawUV);
	}

	protected update(): void {
		if (!this.isLoaded) return;

		const { anchorX, anchorY, debug } = this.parameters;

		let mediaWidth = 0;
		let mediaHeight = 0;

		const media = this.mediaElement;

		if (media instanceof HTMLVideoElement) {
			mediaWidth = media.videoWidth;
			mediaHeight = media.videoHeight;
		} else if (media instanceof HTMLImageElement) {
			mediaWidth = media.naturalWidth || media.width;
			mediaHeight = media.naturalHeight || media.height;
		}

		if (mediaWidth === 0 || mediaHeight === 0) {
			console.debug(
				"[MediaTexture] Media dimensions not ready:",
				mediaWidth,
				"x",
				mediaHeight
			);
			return;
		}

		// Update texture with loaded media (for images only, videos handled by VideoTexture)
		if (!this.isVideo && this._texture.image !== this.mediaElement) {
			console.debug("[MediaTexture] Updating texture image");
			this._texture.image = this.mediaElement;
			this._texture.needsUpdate = true;
		}

		this._widthUniform.value = mediaWidth;
		this._heightUniform.value = mediaHeight;
		this._aspectUniform.value = mediaWidth / mediaHeight;
		this.debugUniform.value = debug ? 1 : 0;
		this.debugLineWidthX.value = 1 / mediaWidth;
		this.debugLineWidthY.value = 1 / mediaHeight;

		this.anchorOffsetXUniform.value = this.computeAnchorOffsetX(anchorX);
		this.anchorOffsetYUniform.value = this.computeAnchorOffsetY(anchorY);
	}

	private sampleTexture(inputUV: Node): Node {
		const transformedUV = vec2(
			inputUV.x.add(this.anchorOffsetXUniform),
			inputUV.y.add(this.anchorOffsetYUniform)
		);

		// Apply texture wrapping
		const { uv: wrappedUV, inBounds } = wrapUV(
			transformedUV,
			this.wrapMode
		);

		// Create or reuse TextureNode with wrapped UVs
		this.textureNode ??= texture(this.texture, wrappedUV);
		const sampled = this.textureNode;

		// Debug edges using wrapped UV coordinates
		const nearLeftEdge = wrappedUV.x
			.greaterThanEqual(0)
			.and(wrappedUV.x.lessThan(this.debugLineWidthX));
		const nearRightEdge = wrappedUV.x
			.greaterThan(float(1).sub(this.debugLineWidthX))
			.and(wrappedUV.x.lessThanEqual(1));
		const nearTopEdge = wrappedUV.y
			.greaterThan(float(1).sub(this.debugLineWidthY))
			.and(wrappedUV.y.lessThanEqual(1));
		const nearBottomEdge = wrappedUV.y
			.greaterThanEqual(0)
			.and(wrappedUV.y.lessThan(this.debugLineWidthY));
		const isEdge = nearLeftEdge
			.or(nearRightEdge)
			.or(nearTopEdge)
			.or(nearBottomEdge);

		const debugColor = vec4(1, 0, 1, 1);

		return select(
			inBounds,
			select(
				isEdge.and(this.debugUniform.greaterThan(0)),
				debugColor,
				sampled
			),
			vec4(0, 0, 0, 0)
		);
	}

	private computeAnchorOffsetX(anchorX: "left" | "center" | "right"): number {
		switch (anchorX) {
			case "left":
				return 0;
			case "right":
				return 1;
			case "center":
			default:
				return 0.5;
		}
	}

	private computeAnchorOffsetY(anchorY: "top" | "center" | "bottom"): number {
		switch (anchorY) {
			case "top":
				return 1;
			case "bottom":
				return 0;
			case "center":
			default:
				return 0.5;
		}
	}

	/**
	 * Dispose of GPU resources and clean up media element event listeners.
	 * Pauses video playback if active.
	 */
	dispose(): void {
		console.debug("[MediaTexture] Disposing");

		// Cancel video frame callback if active
		if (
			this.requestVideoFrameCallbackId !== 0 &&
			this.mediaElement instanceof HTMLVideoElement
		) {
			console.debug("[MediaTexture] Canceling video frame callback");
			this.mediaElement.cancelVideoFrameCallback(
				this.requestVideoFrameCallbackId
			);
			this.requestVideoFrameCallbackId = 0;
		}

		// Pause video if playing
		if (this.isVideo && this.mediaElement instanceof HTMLVideoElement) {
			console.debug("[MediaTexture] Pausing video");
			this.mediaElement.pause();
		}

		super.dispose();
	}

	// Video control methods
	/**
	 * Start video playback. Only works if the media source is a video.
	 *
	 * @returns A promise that resolves when playback starts, or void if not a
	 *   video
	 */
	play(): Promise<void> | void {
		if (this.isVideo && this.mediaElement instanceof HTMLVideoElement) {
			console.debug("[MediaTexture] Playing video");
			return this.mediaElement.play();
		}
		console.warn("[MediaTexture] play() called on non-video media");
	}

	/** Pause video playback. Only works if the media source is a video. */
	pause(): void {
		if (this.isVideo && this.mediaElement instanceof HTMLVideoElement) {
			console.debug("[MediaTexture] Pausing video");
			this.mediaElement.pause();
		} else {
			console.warn("[MediaTexture] pause() called on non-video media");
		}
	}

	/**
	 * Get the current playback time in seconds.
	 *
	 * @returns Current time in seconds, or 0 if not a video
	 */
	get currentTime(): number {
		if (this.isVideo && this.mediaElement instanceof HTMLVideoElement) {
			return this.mediaElement.currentTime;
		}
		return 0;
	}

	/**
	 * Set the current playback time in seconds. Only works if the media source
	 * is a video.
	 */
	set currentTime(time: number) {
		if (this.isVideo && this.mediaElement instanceof HTMLVideoElement) {
			console.debug("[MediaTexture] Setting current time to:", time);
			this.mediaElement.currentTime = time;
		} else {
			console.warn(
				"[MediaTexture] currentTime setter called on non-video media"
			);
		}
	}

	/**
	 * Get the total duration of the video in seconds.
	 *
	 * @returns Duration in seconds, or 0 if not a video
	 */
	get duration(): number {
		if (this.isVideo && this.mediaElement instanceof HTMLVideoElement) {
			return this.mediaElement.duration;
		}
		return 0;
	}

	/**
	 * Check if the video is currently paused.
	 *
	 * @returns True if paused or not a video, false if playing
	 */
	get paused(): boolean {
		if (this.isVideo && this.mediaElement instanceof HTMLVideoElement) {
			return this.mediaElement.paused;
		}
		return true;
	}

	protected getWidth(): number {
		if (!this.isLoaded) return 0;

		const media = this.mediaElement;
		if (media instanceof HTMLVideoElement) {
			return media.videoWidth;
		} else if (media instanceof HTMLImageElement) {
			return media.naturalWidth || media.width;
		}
		return 0;
	}

	protected getHeight(): number {
		if (!this.isLoaded) return 0;

		const media = this.mediaElement;
		if (media instanceof HTMLVideoElement) {
			return media.videoHeight;
		} else if (media instanceof HTMLImageElement) {
			return media.naturalHeight || media.height;
		}
		return 0;
	}

	protected getAspectRatio(): number {
		const h = this.getHeight();
		return h > 0 ? this.getWidth() / h : 1;
	}

	/**
	 * Get a uniform node representing the texture's width in pixels. This
	 * uniform automatically updates when the media loads. Use this in your node
	 * graph for reactive width handling.
	 *
	 * @returns A uniform node containing the width value
	 */
	get widthUniform(): UniformNode<number> {
		return this._widthUniform;
	}

	/**
	 * Get a uniform node representing the texture's height in pixels. This
	 * uniform automatically updates when the media loads. Use this in your node
	 * graph for reactive height handling.
	 *
	 * @returns A uniform node containing the height value
	 */
	get heightUniform(): UniformNode<number> {
		return this._heightUniform;
	}

	/**
	 * Get a uniform node representing the texture's aspect ratio
	 * (width/height). This uniform automatically updates when the media loads.
	 * Use this in your node graph for reactive aspect ratio handling.
	 *
	 * @returns A uniform node containing the aspect ratio
	 */
	get aspectUniform(): UniformNode<number> {
		return this._aspectUniform;
	}
}
