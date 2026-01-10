import { vec3, atan2, cos, sin, pow, PI, sqrt } from "three/tsl";
import { type Node } from "three/webgpu";

/**
 * Converts OKLab color space to linear RGB.
 *
 * @param l - Lightness component, expected range [0, 1]
 * @param a - Green-red component, expected range [-0.4, 0.4]
 * @param b - Blue-yellow component, expected range [-0.4, 0.4]
 * @returns Linear RGB color as a vec3 Node, clamped to [0, 1]
 */
export function oklabToRgb(l: Node, a: Node, b: Node): Node {
	// OKLab to LMS
	const l_ = l.add(a.mul(0.3963377774)).add(b.mul(0.2158037573));
	const m_ = l.add(a.mul(-0.1055613458)).add(b.mul(-0.0638541728));
	const s_ = l.add(a.mul(-0.0894841775)).add(b.mul(-1.291485548));

	// Cubic
	const l_cubed = pow(l_, 3);
	const m_cubed = pow(m_, 3);
	const s_cubed = pow(s_, 3);

	// LMS to linear RGB
	const r = l_cubed
		.mul(4.0767416621)
		.sub(m_cubed.mul(3.3077115913))
		.add(s_cubed.mul(0.2309699292));
	const g = l_cubed
		.mul(-1.2684380046)
		.add(m_cubed.mul(2.6097574011))
		.sub(s_cubed.mul(0.3413193965));
	const br = l_cubed
		.mul(-0.0041960863)
		.sub(m_cubed.mul(0.7034186147))
		.add(s_cubed.mul(1.707614701));

	// Clamp to 0-1
	return vec3(r, g, br).clamp(0, 1);
}

/**
 * Converts OKLch color space to linear RGB.
 *
 * @param l - Lightness component, expected range [0, 1]
 * @param c - Chroma component, expected range [0, ∞) but typically [0, 0.5]
 * @param h - Hue component in degrees, expected range [0, 360]
 * @returns Linear RGB color as a vec3 Node, clamped to [0, 1]
 */
export function oklchToRgb(l: Node, c: Node, h: Node): Node {
	// OKLch to OKLab
	const a = c.mul(cos(h.mul(PI).div(180)));
	const b = c.mul(sin(h.mul(PI).div(180)));

	return oklabToRgb(l, a, b);
}

/**
 * Converts linear RGB to OKLab color space.
 *
 * @param r - Red component, expected range [0, 1]
 * @param g - Green component, expected range [0, 1]
 * @param b - Blue component, expected range [0, 1]
 * @returns OKLab color as a vec3 Node with components (L, a, b)
 */
export function rgbToOklab(r: Node, g: Node, b: Node): Node {
	// Linear RGB to LMS
	const l_ = r.mul(0.3).add(g.mul(0.622)).add(b.mul(0.078));
	const m_ = r.mul(0.23).add(g.mul(0.692)).add(b.mul(0.078));
	const s_ = r
		.mul(0.24342268924)
		.add(g.mul(0.20476744424))
		.add(b.mul(0.55314628651));

	// Cube root
	const l_cbrt = l_.cbrt();
	const m_cbrt = m_.cbrt();
	const s_cbrt = s_.cbrt();

	// LMS to OKLab
	const L = l_cbrt
		.mul(0.2104542553)
		.add(m_cbrt.mul(0.793617785))
		.sub(s_cbrt.mul(0.0040720468));
	const a = l_cbrt
		.mul(1.9779984951)
		.sub(m_cbrt.mul(2.428592205))
		.add(s_cbrt.mul(0.4505937099));
	const resultB = l_cbrt
		.mul(0.0259040371)
		.add(m_cbrt.mul(0.7827717662))
		.sub(s_cbrt.mul(0.808649185));

	return vec3(L, a, resultB);
}

/**
 * Converts linear RGB to OKLch color space.
 *
 * @param r - Red component, expected range [0, 1]
 * @param g - Green component, expected range [0, 1]
 * @param b - Blue component, expected range [0, 1]
 * @returns OKLch color as a vec3 Node with components (L, C, h)
 */
export function rgbToOklch(r: Node, g: Node, b: Node): Node {
	const oklab = rgbToOklab(r, g, b);
	const L = oklab.x;
	const a = oklab.y;
	const ab = oklab.z;

	const C = sqrt(a.mul(a).add(ab.mul(ab)));
	const h = atan2(ab, a).mul(180).div(PI).add(360).mod(360);

	return vec3(L, C, h);
}
