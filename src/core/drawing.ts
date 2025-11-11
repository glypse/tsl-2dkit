import { initCanvas } from "./canvas";

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
	}) {
		const size = Math.max(this.width, this.height);
		const { ctx, canvasTexture } = initCanvas(size, size);
		if (this.backgroundColor !== "transparent") {
			ctx.fillStyle = this.backgroundColor;
			ctx.fillRect(0, 0, size, size);
		}
		const shape = new TextShape({
			string: opts.string,
			x: opts.x ?? size / 2,
			y: opts.y ?? size / 2,
			rotation: opts.rotation ?? 0,
			color: opts.color ?? "#000000",
			size: opts.size ?? 16,
			weight: opts.weight ?? 500,
			fontFamily: opts.fontFamily ?? "Arial"
		});
		shape.draw(ctx);
		canvasTexture.needsUpdate = true;
		return canvasTexture;
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
		ctx.fillText(this.opts.string, this.opts.x, this.opts.y);
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
