// Define all demo pages to be prerendered
import { demoNames } from "$lib/demos-list";

// eslint-disable-next-line jsdoc/require-jsdoc
export function entries(): { demoName: string }[] {
	return demoNames.map((name: string) => ({ demoName: name }));
}
