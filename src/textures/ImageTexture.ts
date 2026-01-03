import { Texture, TextureNode } from "three/webgpu";
import { texture, vec4, vec2, uniform, select, uv, float } from "three/tsl";
import type { Node } from "three/webgpu";
import { LinearFilter } from "three";
import { Canvas2D } from "../core/scene";
import { DynamicTexture } from "./DynamicTexture";

export type ImageTextureOptions = {
	src: string | HTMLImageElement;
	anchorX: "left" | "center" | "right";
	anchorY: "top" | "center" | "bottom";
	debug: boolean;
};

export class ImageTexture extends DynamicTexture {
	config: ImageTextureOptions;

	private widthUniform = uniform(0);
	private heightUniform = uniform(0);
	private anchorOffsetXUniform = uniform(0.5);
	private anchorOffsetYUniform = uniform(0.5);
	private debugUniform = uniform(0);
	private debugLineWidthX = uniform(0);
	private debugLineWidthY = uniform(0);

	private imageElement: HTMLImageElement;
	private textureNode: TextureNode | null = null;
	private isLoaded = false;

	constructor(
		opts: Partial<ImageTextureOptions> & { src: string | HTMLImageElement }
	) {
		// Create initial empty texture
		const initialTexture = new Texture();
		initialTexture.generateMipmaps = false;
		initialTexture.minFilter = LinearFilter;
		initialTexture.magFilter = LinearFilter;

		super(initialTexture);

		this.config = {
			src: opts.src,
			anchorX: opts.anchorX ?? "center",
			anchorY: opts.anchorY ?? "center",
			debug: opts.debug ?? false
		};

		// Load image
		if (typeof opts.src === "string") {
			this.imageElement = new Image();
			this.imageElement.crossOrigin = "anonymous";
			this.imageElement.onload = () => {
				this.isLoaded = true;
				this.needsUpdate = true;
			};
			this.imageElement.src = opts.src;
		} else {
			this.imageElement = opts.src;
			this.isLoaded = true;
		}
	}

	sample(inputUV?: Node): Node {
		const canvas = Canvas2D.currentCanvas;

		// Register for per-frame updates once sampling is requested
		canvas.registerDynamicTexture(this);

		const rawUV = inputUV ?? uv();
		const imageUV = this.screenToImageUV(rawUV, canvas);
		return this.sampleTexture(imageUV);
	}

	protected update(): void {
		if (!this.isLoaded) return;

		const { anchorX, anchorY, debug } = this.config;

		const imageWidth =
			this.imageElement.naturalWidth || this.imageElement.width;
		const imageHeight =
			this.imageElement.naturalHeight || this.imageElement.height;

		if (imageWidth === 0 || imageHeight === 0) return;

		// Update texture with loaded image
		if (this._texture.image !== this.imageElement) {
			this._texture.image = this.imageElement;
			this._texture.needsUpdate = true;
		}

		this.widthUniform.value = imageWidth;
		this.heightUniform.value = imageHeight;
		this.debugUniform.value = debug ? 1 : 0;
		this.debugLineWidthX.value = 1 / imageWidth;
		this.debugLineWidthY.value = 1 / imageHeight;

		this.anchorOffsetXUniform.value = this.computeAnchorOffsetX(anchorX);
		this.anchorOffsetYUniform.value = this.computeAnchorOffsetY(anchorY);
	}

	private sampleTexture(inputUV: Node): Node {
		const transformedUV = vec2(
			inputUV.x.add(this.anchorOffsetXUniform),
			inputUV.y.add(this.anchorOffsetYUniform)
		);

		const inBoundsX = transformedUV.x
			.greaterThanEqual(0)
			.and(transformedUV.x.lessThanEqual(1));
		const inBoundsY = transformedUV.y
			.greaterThanEqual(0)
			.and(transformedUV.y.lessThanEqual(1));
		const inBounds = inBoundsX.and(inBoundsY);

		// Create or reuse TextureNode
		this.textureNode ??= texture(this.texture, transformedUV);
		const sampled = this.textureNode;

		const nearLeftEdge = transformedUV.x
			.greaterThanEqual(0)
			.and(transformedUV.x.lessThan(this.debugLineWidthX));
		const nearRightEdge = transformedUV.x
			.greaterThan(float(1).sub(this.debugLineWidthX))
			.and(transformedUV.x.lessThanEqual(1));
		const nearTopEdge = transformedUV.y
			.greaterThan(float(1).sub(this.debugLineWidthY))
			.and(transformedUV.y.lessThanEqual(1));
		const nearBottomEdge = transformedUV.y
			.greaterThanEqual(0)
			.and(transformedUV.y.lessThan(this.debugLineWidthY));
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

	private screenToImageUV(screenUV: Node, canvas: Canvas2D): Node {
		const screenPixelX = screenUV.x.mul(canvas.widthUniform);
		const screenPixelY = screenUV.y.mul(canvas.heightUniform);

		return vec2(
			screenPixelX.div(this.widthUniform),
			screenPixelY.div(this.heightUniform)
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
}
