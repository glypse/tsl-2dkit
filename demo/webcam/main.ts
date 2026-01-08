/**
 * Webcam + Voronoi Demo
 *
 * Demonstrates using CanvasTexture with the WebRTC getUserMedia API to capture
 * webcam video and overlay a voronoi pattern.
 */

import "$demo/style.css";

import { TSLScene2D, CanvasTexture as TSLCanvasTexture, voronoi } from "$lib";
import { uv, vec2, vec3, mix, time, uniform, float } from "three/tsl";

// Create a canvas to draw the webcam feed
const videoCanvas = document.createElement("canvas");
videoCanvas.width = 640;
videoCanvas.height = 480;
const videoCtxOrNull = videoCanvas.getContext("2d");
if (!videoCtxOrNull) throw new Error("Failed to get 2d context");
const videoCtx: CanvasRenderingContext2D = videoCtxOrNull;

// Create the video element for webcam
const video = document.createElement("video");
video.playsInline = true;
video.muted = true;

// Create the TSL canvas texture from our video canvas
const webcamTexture = new TSLCanvasTexture({
	canvas: videoCanvas,
	anchorX: "left",
	anchorY: "bottom"
});
webcamTexture.wrapMode = "edge";

// Scene setup
const scene = new TSLScene2D(window.innerWidth, window.innerHeight, {
	stats: true,
	renderMode: "continuous" // Continuous for video updates
});

// Voronoi parameters
const voronoiScale = uniform(8);
const voronoiStrength = uniform(0.5);

window.addEventListener("resize", () => {
	scene.setSize(window.innerWidth, window.innerHeight);
});

// Start webcam
async function startWebcam(): Promise<void> {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: {
				width: { ideal: 640 },
				height: { ideal: 480 },
				facingMode: "user"
			}
		});

		video.srcObject = stream;
		await video.play();

		// Update canvas dimensions to match video
		videoCanvas.width = video.videoWidth || 640;
		videoCanvas.height = video.videoHeight || 480;

		// Start drawing video to canvas
		function drawVideoFrame(): void {
			if (video.readyState >= video.HAVE_CURRENT_DATA) {
				// Flip horizontally for mirror effect
				videoCtx.save();
				videoCtx.scale(-1, 1);
				videoCtx.drawImage(video, -videoCanvas.width, 0);
				videoCtx.restore();

				// Mark texture as needing update
				webcamTexture.needsUpdate = true;
			}
			requestAnimationFrame(drawVideoFrame);
		}
		drawVideoFrame();

		console.log("Webcam started successfully");
	} catch (error) {
		console.error("Failed to access webcam:", error);

		// Fallback: draw a test pattern
		function drawTestPattern(): void {
			const t = performance.now() * 0.001;
			videoCtx.fillStyle = `hsl(${String((t * 50) % 360)}, 70%, 50%)`;
			videoCtx.fillRect(0, 0, videoCanvas.width, videoCanvas.height);

			// Draw some moving circles
			for (let i = 0; i < 5; i++) {
				const x =
					videoCanvas.width / 2 +
					Math.cos(t + i * 1.2) * videoCanvas.width * 0.3;
				const y =
					videoCanvas.height / 2 +
					Math.sin(t * 1.3 + i * 1.5) * videoCanvas.height * 0.3;

				videoCtx.fillStyle = `hsl(${String((t * 100 + i * 72) % 360)}, 80%, 60%)`;
				videoCtx.beginPath();
				videoCtx.arc(x, y, 40, 0, Math.PI * 2);
				videoCtx.fill();
			}

			webcamTexture.needsUpdate = true;
			requestAnimationFrame(drawTestPattern);
		}
		drawTestPattern();
	}
}

await scene.build(() => {
	const UV = uv();

	// Calculate aspect-corrected UVs for the webcam texture
	const aspectRatio = float(videoCanvas.width).div(videoCanvas.height);
	const sceneAspect = scene.aspectUniform;

	// Fit webcam to screen (cover mode)
	const centered = UV.sub(vec2(0.5, 0.5));

	// Adjust for aspect ratio difference
	const webcamUV = vec2(
		centered.x.mul(sceneAspect.div(aspectRatio).max(1)),
		centered.y.mul(aspectRatio.div(sceneAspect).max(1))
	).add(vec2(0.5, 0.5));

	// Sample the webcam
	const webcamColor = webcamTexture.sample(webcamUV);

	// Create voronoi pattern
	const voronoiUV = vec3(
		UV.x.mul(voronoiScale).mul(scene.aspectUniform),
		UV.y.mul(voronoiScale),
		time.mul(0.5) // Animate in Z
	);

	const voronoiResult = voronoi(voronoiUV, {
		featureOutput: "f1",
		exponent: float(2),
		randomness: float(1)
	});

	// Use voronoi distance for effect
	const voronoiEdge = voronoiResult.get("distance").x;

	// Create edge highlight effect
	const edgeIntensity = float(1).sub(voronoiEdge.mul(3).clamp(0, 1));

	// Mix webcam with voronoi-based color shift
	const shiftedColor = vec3(
		webcamColor.r.add(edgeIntensity.mul(voronoiStrength).mul(0.3)),
		webcamColor.g.sub(edgeIntensity.mul(voronoiStrength).mul(0.1)),
		webcamColor.b.add(edgeIntensity.mul(voronoiStrength).mul(0.2))
	);

	// Add voronoi cell edge as overlay
	const edgeColor = vec3(1, 0.5, 0);
	const finalColor = mix(
		shiftedColor,
		edgeColor,
		edgeIntensity.mul(voronoiStrength).mul(0.5)
	);

	return finalColor;
});

// Start the webcam
void startWebcam();

document.body.appendChild(scene.canvasElement);

// Info and controls
const info = document.createElement("div");
info.style.cssText =
	"position:fixed;top:10px;left:10px;color:white;font-family:monospace;background:rgba(0,0,0,0.5);padding:10px;border-radius:4px;";
info.innerHTML = `
<strong>Webcam + Voronoi Demo</strong><br>
<label>Scale: <input type="range" id="scale" min="2" max="20" step="0.5" value="8"></label><br>
<label>Strength: <input type="range" id="strength" min="0" max="1" step="0.05" value="0.5"></label>
`;
document.body.appendChild(info);

// Scale slider
const scaleSlider = document.getElementById("scale") as HTMLInputElement;
scaleSlider.addEventListener("input", () => {
	voronoiScale.value = parseFloat(scaleSlider.value);
});

// Strength slider
const strengthSlider = document.getElementById("strength") as HTMLInputElement;
strengthSlider.addEventListener("input", () => {
	voronoiStrength.value = parseFloat(strengthSlider.value);
});
