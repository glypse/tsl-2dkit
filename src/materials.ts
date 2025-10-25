import { type ShaderNodeObject } from "three/tsl";
import {
	CanvasTexture,
	MeshBasicNodeMaterial,
	NodeMaterial,
	TextureNode
} from "three/webgpu";
import { initCanvas } from "./canvas";
import { uv, texture } from "three/tsl";

export class TSLMaterial<T extends unknown[] = []> {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	canvasTexture: CanvasTexture;
	material: NodeMaterial;

	private drawFn: (...args: T) => void;
	private resizeFn: (w: number, h: number) => void;
	private outFn?: (
		canvasTexture: CanvasTexture
	) => ShaderNodeObject<TextureNode>;

	constructor(
		width: number,
		height: number,
		options: {
			initCanvas?: typeof initCanvas;
			draw?: (material: TSLMaterial<unknown[]>, ...args: T) => void;
			outputNode?: (
				canvasTexture: CanvasTexture
			) => ShaderNodeObject<TextureNode>;
			resize?: (material: TSLMaterial<T>, w: number, h: number) => void;
		} = {}
	) {
		const {
			initCanvas: initFn = initCanvas,
			draw: drawFn,
			outputNode: outFn,
			resize: resizeFn
		} = options;

		this.outFn = outFn;

		const { canvas, ctx, canvasTexture } = initFn({ width, height });
		this.canvas = canvas;
		this.ctx = ctx;
		this.canvasTexture = canvasTexture;

		this.material = new MeshBasicNodeMaterial({
			colorNode: outFn
				? outFn(this.canvasTexture)
				: texture(this.canvasTexture, uv())
		});

		this.drawFn = drawFn
			? (...args: T) =>
					drawFn(this as unknown as TSLMaterial<unknown[]>, ...args)
			: () => this.defaultDraw(this);

		this.resizeFn = resizeFn
			? (w: number, h: number) =>
					resizeFn(this as unknown as TSLMaterial<unknown[]>, w, h)
			: (w: number, h: number) => this.defaultResize(this, w, h);

		this.draw = this.draw.bind(this);
		this.resize = this.resize.bind(this);
	}

	draw(...args: T) {
		this.drawFn(...args);
	}

	resize(w: number, h: number) {
		this.resizeFn(w, h);
	}

	private defaultDraw(material: TSLMaterial<T>) {
		material.ctx.clearRect(
			0,
			0,
			material.canvas.width,
			material.canvas.height
		);
	}

	private defaultResize(material: TSLMaterial<T>, w: number, h: number) {
		material.canvasTexture.dispose();
		const {
			canvas,
			ctx,
			canvasTexture: newCanvasTexture
		} = initCanvas({ width: w, height: h });
		material.canvas = canvas;
		material.ctx = ctx;
		material.canvasTexture = newCanvasTexture;
		material.material.colorNode = material.outFn
			? material.outFn(material.canvasTexture)
			: texture(material.canvasTexture, uv());
		material.material.needsUpdate = true;
	}
}
