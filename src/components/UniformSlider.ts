import { type uniform } from "three/tsl";

/**
 * A UI component that creates a slider control for manipulating a Three.js
 * uniform value. Creates an HTML range input with a label that automatically
 * updates the uniform value when the slider is moved.
 */
export class UniformSlider {
	private input: HTMLInputElement;
	private label: HTMLLabelElement;
	private eventListener: (() => void) | null = null;

	/**
	 * Creates a new UniformSlider and appends it to the specified container.
	 *
	 * @param container - The HTML element to append the slider controls to
	 * @param labelText - The text label to display next to the slider
	 * @param uniformNode - The Three.js uniform node to control with this
	 *   slider
	 * @param options - Configuration options for the slider range and behavior
	 * @param options.max - Maximum slider value
	 * @param options.min - Minimum slider value
	 * @param options.step - Step size of the slider
	 * @default 0.001
	 * @param options.value - Default slider value
	 */
	constructor(
		container: HTMLElement,
		labelText: string,
		uniformNode: ReturnType<typeof uniform>,
		options: {
			min: number;
			max: number;
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

		this.eventListener = () => {
			uniformNode.value = parseFloat(this.input.value);
		};
		this.input.addEventListener("input", this.eventListener);
	}

	/**
	 * Dispose of the slider component by removing DOM elements and event listeners.
	 * This should be called when the UniformSlider is no longer needed to prevent
	 * memory leaks and remove UI elements from the DOM.
	 */
	dispose(): void {
		// Remove event listener
		if (this.eventListener) {
			this.input.removeEventListener("input", this.eventListener);
			this.eventListener = null;
		}

		// Remove DOM elements from their parent
		if (this.label.parentNode) {
			this.label.parentNode.removeChild(this.label);
		}
		if (this.input.parentNode) {
			this.input.parentNode.removeChild(this.input);
		}
	}
}
