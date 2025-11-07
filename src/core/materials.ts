import { Node, NodeMaterial } from "three/webgpu";

export type TSLMaterial = {
	material: NodeMaterial;
	draw: (...args: Node[]) => void;
	resize: (width: number, height: number, ...args: Node[]) => void;
};
