import "./style.css";

import { Canvas2D, writeText, fill } from "$lib";

const canvas = new Canvas2D(document.querySelector("#app")!, 800, 800);

canvas.draw(() => {
	fill("#00ff00");
	writeText({
		string: "a",
		size: Math.max(800, 800),
		weight: 500
	});
});
