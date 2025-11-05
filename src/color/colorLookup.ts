import { vec2, texture, clamp } from "three/tsl";
import { Texture } from "three";
import { type FloatNode, type Vec3Node } from "../core/materials";

export function colorLookup(value: FloatNode, mapTexture: Texture): Vec3Node {
	const clampedValue = clamp(value, 0, 1);
	const sampleUV = vec2(clampedValue, 0.5);
	return texture(mapTexture, sampleUV).rgb as Vec3Node;
}
