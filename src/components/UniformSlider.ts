import { uniform } from "three/tsl";

export class UniformSlider {
	private input: HTMLInputElement;
	private label: HTMLLabelElement;

	constructor(
		container: HTMLElement,
		labelText: string,
		uniformNode: ReturnType<typeof uniform>,
		options: { min: number; max: number; step?: number; value?: number }
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
