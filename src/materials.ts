import { NodeMaterial } from "three/webgpu";

export type TSLMaterial = {
	material: NodeMaterial;
	// oxlint-disable-next-line no-explicit-any
	draw: (...args: any[]) => void;
	// oxlint-disable-next-line no-explicit-any
	resize: (width: number, height: number, ...args: any[]) => void;
};
