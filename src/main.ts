import "./styles.css";
import { SolarSystem } from "./core/SolarSystem";

/**
 * DS4 Solar System — entry point.
 * Mounts the Three.js scene, lights, logarithmic orbit paths, planetary bodies
 * and their moons, then starts the simulation animation loop.
 */
const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.textContent = "";
  new SolarSystem(app).start();
}
