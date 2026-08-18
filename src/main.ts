import "./styles.css";

/**
 * DS4 Solar System — bootstrap entry point.
 * Phase note: later visualization phases replace this minimal stub.
 * This bootstrap only proves the Vite+TS runtime mounts without errors.
 */
function bootstrap(): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;
  app.textContent = "Booting Logarithmic Solar System…";
}

bootstrap();
