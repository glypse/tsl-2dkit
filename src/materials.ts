import { Node, NodeMaterial } from "three/webgpu";
import { mix, vec3 } from "three/tsl";
import type { ShaderNodeObject } from "three/tsl";

// Local minimal NodeLike interfaces (option B). These represent the small
// surface our code relies on instead of depending on many internal three
// node shapes. They are structural and intentionally minimal:
// - Vec3Like: a shader node object representing a vec3
// - FloatLike: a shader node object representing a float
// - Vec4LayerLike: a vec4-like node which exposes `.rgb` (vec3) and `.a` (float)
export type Vec3Like = ShaderNodeObject<Node>;
export type FloatLike = ShaderNodeObject<Node>;
export interface Vec4LayerLike extends ShaderNodeObject<Node> {
	rgb: Vec3Like;
	a: FloatLike;
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

// Composite an array of vec4 layers into a single vec3 color using standard
// alpha blending: out = mix(bg, fg.rgb, fg.a)
export function compositeLayers(layers: Vec4LayerLike[]): Vec3Like {
	if (layers.length === 0) return vec3(0) as Vec3Like;

	let out: Vec3Like = layers[0].rgb;
	for (let i = 1; i < layers.length; i++) {
		const fg = layers[i];
		out = mix(out, fg.rgb, fg.a) as Vec3Like;
	}
	return out;
}
