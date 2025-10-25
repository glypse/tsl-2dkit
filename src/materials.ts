import { type ShaderNodeFn } from "three/src/nodes/TSL.js";
import {
	CanvasTexture,
	MeshBasicNodeMaterial,
	NodeMaterial
} from "three/webgpu";
import { initCanvas } from "./canvas";
import { Fn, uv, texture } from "three/tsl";

export class TSLMaterial<T extends unknown[] = []> {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	canvasTexture: CanvasTexture;
	material: NodeMaterial;

	private drawFn: (...args: T) => void;
	private resizeFn: (w: number, h: number) => void;
	private outFn?: (canvasTexture: CanvasTexture) => ShaderNodeFn<[]>;
	private outputNodeFn: ShaderNodeFn<[]>;

	constructor(
		width: number,
		height: number,
		options: {
			initCanvas?: typeof initCanvas;
			draw?: (material: TSLMaterial<unknown[]>, ...args: T) => void;
			outputNode?: (canvasTexture: CanvasTexture) => ShaderNodeFn<[]>;
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

		this.outputNodeFn = outFn
			? outFn(this.canvasTexture)
			: Fn(() => texture(this.canvasTexture, uv()));

		this.material = new MeshBasicNodeMaterial({
			colorNode: this.outputNodeFn()
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
		material.outputNodeFn = material.outFn
			? material.outFn(material.canvasTexture)
			: Fn(() => texture(material.canvasTexture, uv()));
		material.material.colorNode = material.outputNodeFn();
		material.material.needsUpdate = true;
	}
}
