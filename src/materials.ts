import { type ShaderNodeFn } from "three/src/nodes/TSL.js";
import {
	CanvasTexture,
	MeshBasicNodeMaterial,
	NodeMaterial
} from "three/webgpu";
import { initCanvas } from "./canvas";
import { Fn, uv, texture } from "three/tsl";

export class TSLMaterial {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	canvasTexture: CanvasTexture;
	material: NodeMaterial;

	// oxlint-disable-next-line no-explicit-any
	private drawFn: (...args: any[]) => void;
	private resizeFn: (w: number, h: number) => void;
	private outFn?: (canvasTexture: CanvasTexture) => ShaderNodeFn<[]>;
	private outputNodeFn: ShaderNodeFn<[]>;

	constructor(
		width: number,
		height: number,
		options: {
			initCanvas?: typeof initCanvas;
			// oxlint-disable-next-line no-explicit-any
			draw?: (this: TSLMaterial, ...args: any[]) => void;
			outputNode?: (canvasTexture: CanvasTexture) => ShaderNodeFn<[]>;
			resize?: (this: TSLMaterial, w: number, h: number) => void;
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
			? // oxlint-disable-next-line no-explicit-any
				(...args: any[]) => drawFn.call(this, ...args)
			: this.defaultDraw.bind(this);

		this.resizeFn = resizeFn
			? (w: number, h: number) => resizeFn.call(this, w, h)
			: this.defaultResize.bind(this);

		this.draw = this.draw.bind(this);
		this.resize = this.resize.bind(this);
	}

	// oxlint-disable-next-line no-explicit-any
	draw(...args: any[]) {
		this.drawFn(...args);
	}

	resize(w: number, h: number) {
		this.resizeFn(w, h);
	}

	private defaultDraw() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	private defaultResize(w: number, h: number) {
		this.canvasTexture.dispose();
		const {
			canvas,
			ctx,
			canvasTexture: newCanvasTexture
		} = initCanvas({ width: w, height: h });
		this.canvas = canvas;
		this.ctx = ctx;
		this.canvasTexture = newCanvasTexture;
		this.outputNodeFn = this.outFn
			? this.outFn(this.canvasTexture)
			: Fn(() => texture(this.canvasTexture, uv()));
		this.material.colorNode = this.outputNodeFn();
		this.material.needsUpdate = true;
	}
}
