import { CanvasTexture } from "three/webgpu";

export interface Shape {
	draw(ctx: CanvasRenderingContext2D): void;
}

export class DrawingContext {
	private ctx: CanvasRenderingContext2D;
	private canvasTexture: CanvasTexture;
	private width: number;
	private height: number;
	private currentColor = "#000000";

	constructor(
		ctx: CanvasRenderingContext2D,
		canvasTexture: CanvasTexture,
		width: number,
		height: number
	) {
		this.ctx = ctx;
		this.canvasTexture = canvasTexture;
		this.width = width;
		this.height = height;
	}

	// State setters
	fill(color: string) {
		this.currentColor = color;
		return this;
	}

	// Drawing functions
	writeText(opts: {
		string: string;
		x?: number;
		y?: number;
		rotation?: number;
		color?: string;
		size?: number;
		weight?: number;
	}) {
		const shape = new TextShape({
			string: opts.string,
			x: opts.x ?? this.width / 2,
			y: opts.y ?? this.height / 2,
			rotation: opts.rotation ?? 0,
			color: opts.color || this.currentColor,
			size: opts.size ?? 16,
			weight: opts.weight ?? 500
		});
		shape.draw(this.ctx);
		this.canvasTexture.needsUpdate = true;
	}

	// Add more shapes here (rect, etc.)
}

class TextShape implements Shape {
	private opts: {
		string: string;
		x: number;
		y: number;
		rotation: number;
		color: string;
		size: number;
		weight: number;
	};

	constructor(opts: {
		string: string;
		x: number;
		y: number;
		rotation: number;
		color: string;
		size: number;
		weight: number;
	}) {
		this.opts = opts;
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.translate(this.opts.x, this.opts.y);
		ctx.rotate(this.opts.rotation);
		ctx.fillStyle = this.opts.color;
		ctx.font = `${this.opts.weight} ${this.opts.size}px Arial`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(this.opts.string, 0, 0);
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
export function fill(color: string) {
	globalContext?.fill(color);
}
export function writeText(opts: Parameters<DrawingContext["writeText"]>[0]) {
	globalContext?.writeText(opts);
}
// Add push, pop, etc.
