import { initCanvas } from "./canvas";
import { sRGBTransferEOTF, texture, vec4 } from "three/tsl";
import type { Node } from "three/webgpu";

export class DrawingContext {
	private width: number;
	private height: number;
	private backgroundColor = "transparent";

	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
	}

	resize(width: number, height: number) {
		this.width = width;
		this.height = height;
	}

	setBackgroundColor(color: string) {
		this.backgroundColor = color;
	}

	// Drawing functions
	textNode(opts: {
		string: string;
		x?: number;
		y?: number;
		rotation?: number;
		color?: string;
		size?: number;
		weight?: number;
		fontFamily?: string;
		letterSpacing?: string;
		lineHeight?: number;
	}) {
		const { ctx, canvasTexture } = initCanvas(this.width, this.height);
		if (this.backgroundColor !== "transparent") {
			ctx.fillStyle = this.backgroundColor;
			ctx.fillRect(0, 0, this.width, this.height);
		}
		const shape = new TextShape({
			string: opts.string,
			x: opts.x ?? this.width / 2,
			y: opts.y ?? this.height / 2,
			rotation: opts.rotation ?? 0,
			color: opts.color ?? "#000000",
			size: opts.size ?? 16,
			weight: opts.weight ?? 500,
			fontFamily: opts.fontFamily ?? "Arial",
			letterSpacing: opts.letterSpacing ?? "0",
			lineHeight: opts.lineHeight ?? 1.2
		});
		shape.draw(ctx);
		canvasTexture.needsUpdate = true;
		return (uv: Node) => {
			const sampled = texture(canvasTexture, uv);
			return vec4(sRGBTransferEOTF(sampled.rgb), sampled.a);
		};
	}

	// Add more shapes here (rect, etc.)
}

export type Shape = {
	draw(ctx: CanvasRenderingContext2D): void;
};

class TextShape implements Shape {
	private opts: {
		string: string;
		x: number;
		y: number;
		rotation: number;
		color: string;
		size: number;
		weight: number;
		fontFamily: string;
		letterSpacing: string;
		lineHeight: number;
	};

	constructor(opts: {
		string: string;
		x: number;
		y: number;
		rotation: number;
		color: string;
		size: number;
		weight: number;
		fontFamily: string;
		letterSpacing: string;
		lineHeight: number;
	}) {
		this.opts = opts;
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.rotate(this.opts.rotation);
		ctx.fillStyle = this.opts.color;
		ctx.font = `${this.opts.weight.toString()} ${this.opts.size.toString()}px ${this.opts.fontFamily}`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.letterSpacing = this.opts.letterSpacing;

		const lines = this.opts.string.split("\n");
		const lineHeight = this.opts.size * this.opts.lineHeight;
		const totalHeight = lines.length * lineHeight;
		let currentY = this.opts.y - totalHeight / 2 + lineHeight / 2;

		for (const line of lines) {
			ctx.fillText(line, this.opts.x, currentY);
			currentY += lineHeight;
		}

		ctx.restore();
	}
}

// Global instance
let globalContext: DrawingContext | null = null;
export function getDrawingContext() {
	return globalContext;
}
export function setDrawingContext(ctx: DrawingContext) {
	globalContext = ctx;
}

// Global functions
export function textNode(opts: Parameters<DrawingContext["textNode"]>[0]) {
	if (!globalContext) throw new Error("Drawing context not set");
	return globalContext.textNode(opts);
}

export function setBackgroundColor(color: string) {
	globalContext?.setBackgroundColor(color);
}
