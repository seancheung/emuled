import { defineConfig } from "tsup";

export default defineConfig(({ watch }) => {
  return {
    entry: ["src/index.ts"],
    splitting: false,
    sourcemap: !!watch,
    target: "node18",
    clean: !watch,
    minify: !watch,
    dts: !watch,
  };
});
