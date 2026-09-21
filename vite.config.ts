import { defineConfig } from "vite";
import { jevPlugin } from "./src/server/plugin";

export default defineConfig({
  plugins: [jevPlugin()],
});
