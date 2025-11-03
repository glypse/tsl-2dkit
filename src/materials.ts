import { Node, NodeMaterial } from "three/webgpu";
import { type ShaderNodeObject } from "three/tsl";

export type FloatLike = ShaderNodeObject<Node & { readonly nodeType: "float" }>;
/* export type Vec2Like = ShaderNodeObject<Node & { readonly nodeType: "vec2" }>; */
export type Vec3Like = ShaderNodeObject<Node & { readonly nodeType: "vec3" }>;
export interface Vec4LayerLike extends ShaderNodeObject<Node> {
	rgb: ShaderNodeObject<Node>;
	a: ShaderNodeObject<Node>;
}

export type TSLMaterial = {
	material: NodeMaterial;
	draw: (...args: Array<Vec3Like | Vec4LayerLike>) => void;
	resize: (
		width: number,
		height: number,
		...args: Array<Vec3Like | Vec4LayerLike>
	) => void;
};
