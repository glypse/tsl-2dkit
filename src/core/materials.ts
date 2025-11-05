import { Node, NodeMaterial } from "three/webgpu";
import { type ShaderNodeObject } from "three/tsl";

export type FloatNode = ShaderNodeObject<Node>;
/* export type Vec2Node = ShaderNodeObject<Node>; */
export type Vec3Node = ShaderNodeObject<Node>;
export type Vec4Node = ShaderNodeObject<Node>;

export type TSLMaterial = {
	material: NodeMaterial;
	draw: (...args: Array<Vec3Node | Vec4Node>) => void;
	resize: (
		width: number,
		height: number,
		...args: Array<Vec3Node | Vec4Node>
	) => void;
};
