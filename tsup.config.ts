import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli/app.ts"],
  format: ["cjs"],
  dts: false,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
});
