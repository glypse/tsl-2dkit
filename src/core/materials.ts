import { Node, NodeMaterial } from "three/webgpu";

export type TSLMaterial = {
	material: NodeMaterial;
	draw: (...args: Array<Node>) => void;
	resize: (width: number, height: number, ...args: Array<Node>) => void;
};
