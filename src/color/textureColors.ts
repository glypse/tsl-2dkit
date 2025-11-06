import { vec3, cos, sin, pow, PI } from "three/tsl";
import { Node } from "three/webgpu";

/**
 * Converts OKLch color space to linear RGB.
 * @param l - Lightness component, expected range [0, 1]
 * @param c - Chroma component, expected range [0, ∞) but typically [0, 0.5]
 * @param h - Hue component in degrees, expected range [0, 360]
 * @returns Linear RGB color as a vec3 Node, clamped to [0, 1]
 */
export function oklchToRgb(l: Node, c: Node, h: Node): Node {
	// OKLch to OKLab
	const a_ = c.mul(cos(h.mul(PI).div(180)));
	const b_ = c.mul(sin(h.mul(PI).div(180)));
	// OKLab (L, a, b): (l, a_, b_)

	// OKLab to LMS
	const l_ = l.add(a_.mul(0.3963377774)).add(b_.mul(0.2158037573));
	const m_ = l.add(a_.mul(-0.1055613458)).add(b_.mul(-0.0638541728));
	const s_ = l.add(a_.mul(-0.0894841775)).add(b_.mul(-1.291485548));

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
	const b = l_cubed
		.mul(-0.0041960863)
		.sub(m_cubed.mul(0.7034186147))
		.add(s_cubed.mul(1.707614701));

	// Clamp to 0-1
	return vec3(r, g, b).clamp(0, 1);
}
