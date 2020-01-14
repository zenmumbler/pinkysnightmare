import resolve from "@rollup/plugin-node-resolve";
import tsc from "rollup-plugin-typescript2";
import typescript from "typescript";

export default [
	{
		input: `src/pinkydream.ts`,
		output: [{
			file: `build/pinkydream.js`,
			format: "iife",
			name: "pinkydream",
		}],
		plugins: [
			resolve({ browser: true }),
			tsc({ typescript })
		]
	}
];
