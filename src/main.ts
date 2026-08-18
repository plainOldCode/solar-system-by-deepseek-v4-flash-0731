import "./styles.css";
import { AppController } from "./ui/AppController";

/**
 * DS4 Solar System — entry point.
 *
 * The interaction/presentation layer (AppController) attaches to the existing
 * scene hierarchy in #app: it composes the SolarSystem scene/simulation with
 * a CameraRig (OrbitControls + focus/follow), on-scene labels, a selection
 * ring, the info panel, and the control bar.
 */
const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  new AppController(app);
}
