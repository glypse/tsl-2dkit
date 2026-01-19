import { color } from "three/tsl";
import {
	TSLScene2D,
	aspectCorrectedUV,
	colorLookup,
	gradient,
	type ColorStop
} from "tsl-2dkit";

const container = document.getElementById("demo-container");

/**
 * Simple gradient map demo.
 */
export default function (): void {
	// Create controls div
	const controls = document.createElement("div");
	controls.id = "controls";
	container?.appendChild(controls);

	// Create control section for mode select
	const controlSection = document.createElement("div");
	controlSection.className = "control-section";
	controls.appendChild(controlSection);

	const modeLabel = document.createElement("label");
	modeLabel.textContent = "Interpolation Mode: ";
	controlSection.appendChild(modeLabel);

	const modeSelect = document.createElement("select");
	modeSelect.id = "mode-select";
	const rgbOption = document.createElement("option");
	rgbOption.value = "rgb";
	rgbOption.textContent = "RGB";
	modeSelect.appendChild(rgbOption);
	const oklchOption = document.createElement("option");
	oklchOption.value = "oklch";
	oklchOption.textContent = "OKLCH";
	modeSelect.appendChild(oklchOption);
	modeLabel.appendChild(modeSelect);

	// Create stops container
	const stopsContainer = document.createElement("div");
	stopsContainer.id = "stops-container";
	controls.appendChild(stopsContainer);

	// Create add stop button
	const addStopButton = document.createElement("button");
	addStopButton.id = "add-stop";
	addStopButton.textContent = "+ Add Stop";
	controls.appendChild(addStopButton);

	// Initialize scene
	const scene = new TSLScene2D(window.innerWidth, window.innerHeight, {
		renderMode: "on-demand"
	});

	window.addEventListener("resize", () => {
		scene.setSize(window.innerWidth, window.innerHeight);
	});

	// Define local type for gradient stops with hex
	type GradientStop = ColorStop & { hex: string };

	const gradientStops: GradientStop[] = [
		{ position: 0, color: color("#ff0000"), hex: "#ff0000" },
		{ position: 0.5, color: color("#00ff00"), hex: "#00ff00" },
		{ position: 1, color: color("#0000ff"), hex: "#0000ff" }
	];

	let interpolationMode: "rgb" | "oklch" = "rgb";

	// Function to build the shader scene
	function buildShaderScene(): void {
		scene.invalidateNodeGraph();
		void scene.build(() => {
			const UV = aspectCorrectedUV();

			// Create gradient along the longer axis
			const isLandscape = window.innerWidth > window.innerHeight;
			const t = isLandscape ? UV.x : UV.y;

			// Create gradient function
			const gradFn = gradient(gradientStops, interpolationMode);

			// Apply gradient to the value
			return colorLookup(t, gradFn);
		});
	}

	// UI Management

	function createStopUI(stop: GradientStop, index: number): HTMLDivElement {
		const stopDiv = document.createElement("div");
		stopDiv.className = "stop-control";
		stopDiv.style.cssText = `
		display: flex;
		gap: 10px;
		align-items: center;
		margin: 10px 0;
		padding: 10px;
		background: rgba(255,255,255,0.1);
		border-radius: 4px;
	`;

		// Position slider
		const positionLabel = document.createElement("label");
		positionLabel.textContent = "Position:";
		positionLabel.style.minWidth = "70px";

		const positionInput = document.createElement("input");
		positionInput.type = "range";
		positionInput.min = "0";
		positionInput.max = "1";
		positionInput.step = "0.01";
		positionInput.value = stop.position.toString();
		positionInput.style.flex = "1";

		const positionValue = document.createElement("span");
		positionValue.textContent = stop.position.toFixed(2);
		positionValue.style.minWidth = "40px";

		positionInput.addEventListener("input", () => {
			const newPos = parseFloat(positionInput.value);
			gradientStops[index].position = newPos;
			positionValue.textContent = newPos.toFixed(2);
			buildShaderScene();
		});

		// Color picker
		const colorLabel = document.createElement("label");
		colorLabel.textContent = "Color:";
		colorLabel.style.minWidth = "50px";

		const colorInput = document.createElement("input");
		colorInput.type = "color";
		colorInput.value = stop.hex;

		colorInput.addEventListener("input", () => {
			gradientStops[index].hex = colorInput.value;
			gradientStops[index].color = color(colorInput.value);
			buildShaderScene();
		});

		// Remove button
		const removeButton = document.createElement("button");
		removeButton.textContent = "×";
		removeButton.style.cssText = `
		padding: 4px 12px;
		font-size: 20px;
		line-height: 1;
		background: rgba(255,0,0,0.5);
		border: none;
		border-radius: 4px;
		cursor: pointer;
	`;

		removeButton.addEventListener("click", () => {
			if (gradientStops.length > 2) {
				gradientStops.splice(index, 1);
				rebuildUI();
				buildShaderScene();
			}
		});

		// Disable remove button if only 2 stops left
		if (gradientStops.length <= 2) {
			removeButton.disabled = true;
			removeButton.style.opacity = "0.3";
			removeButton.style.cursor = "not-allowed";
		}

		stopDiv.appendChild(positionLabel);
		stopDiv.appendChild(positionInput);
		stopDiv.appendChild(positionValue);
		stopDiv.appendChild(colorLabel);
		stopDiv.appendChild(colorInput);
		stopDiv.appendChild(removeButton);

		return stopDiv;
	}

	function rebuildUI(): void {
		stopsContainer.innerHTML = "";
		gradientStops.forEach((stop, index) => {
			stopsContainer.appendChild(createStopUI(stop, index));
		});
	}

	// Mode selector
	modeSelect.value = interpolationMode;
	modeSelect.addEventListener("change", () => {
		interpolationMode = modeSelect.value as "rgb" | "oklch";
		buildShaderScene();
	});

	// Add stop button
	addStopButton.addEventListener("click", () => {
		// Find a good position to insert the new stop
		const positions = gradientStops
			.map((s) => s.position)
			.sort((a, b) => a - b);
		let newPosition = 0.5;

		// Find the largest gap
		let maxGap = 0;
		let gapPosition = 0.5;
		for (let i = 0; i < positions.length - 1; i++) {
			const gap = positions[i + 1] - positions[i];
			if (gap > maxGap) {
				maxGap = gap;
				gapPosition = (positions[i] + positions[i + 1]) / 2;
			}
		}
		newPosition = gapPosition;

		gradientStops.push({
			position: newPosition,
			color: color("#ffffff"),
			hex: "#ffffff"
		});

		rebuildUI();
		buildShaderScene();
	});

	// Initialize UI
	rebuildUI();

	// Build initial shader
	void scene
		.build(() => {
			const UV = aspectCorrectedUV();

			// Create gradient along the longer axis
			const isLandscape = window.innerWidth > window.innerHeight;
			const t = isLandscape ? UV.x : UV.y;

			// Create gradient function
			const gradFn = gradient(gradientStops, interpolationMode);

			// Apply gradient to the value
			return colorLookup(t, gradFn);
		})
		.then(() => {
			container?.appendChild(scene.canvasElement);
		});
}
