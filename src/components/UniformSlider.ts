import { type uniform } from "three/tsl";

/**
 * A UI component that creates a slider control for manipulating a Three.js
 * uniform value. Creates an HTML range input with a label that automatically
 * updates the uniform value when the slider is moved.
 */
export class UniformSlider {
	private input: HTMLInputElement;
	private label: HTMLLabelElement;

	/**
	 * Creates a new UniformSlider and appends it to the specified container.
	 *
	 * @param container - The HTML element to append the slider controls to
	 * @param labelText - The text label to display next to the slider
	 * @param uniformNode - The Three.js uniform node to control with this
	 *   slider
	 * @param options - Configuration options for the slider range and behavior
	 */
	constructor(
		container: HTMLElement,
		labelText: string,
		uniformNode: ReturnType<typeof uniform>,
		options: {
			min: number;
			max: number;
			/** @defaultValue 0.001 */
			step?: number;
			value?: number;
		}
	) {
		this.label = document.createElement("label");
		this.label.textContent = labelText + " ";

		this.input = document.createElement("input");
		this.input.type = "range";
		this.input.min = options.min.toString();
		this.input.max = options.max.toString();
		this.input.step = (options.step ?? 0.001).toString();
		this.input.value = (
			options.value ?? (uniformNode as { value: number }).value
		).toString();

		container.appendChild(this.label);
		container.appendChild(this.input);
		container.appendChild(document.createElement("br"));

		this.input.addEventListener("input", () => {
			uniformNode.value = parseFloat(this.input.value);
		});
	}
}
