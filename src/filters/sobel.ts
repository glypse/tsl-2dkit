import { Fn, vec2, length, dFdx, dFdy, luminance } from "three/tsl";
import { Node } from "three/webgpu";

const sobelFn = Fn((inputs: [Node]) => {
	const [value] = inputs;
	const lum = luminance(value);
	const gradX = dFdx(lum);
	const gradY = dFdy(lum);
	return length(vec2(gradX, gradY));
}).setLayout({
	name: "sobel",
	type: "float",
	inputs: [{ name: "value", type: "vec3" }]
});

export function sobel(value: Node) {
	return sobelFn(value);
}
