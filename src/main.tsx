import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ensureTalib } from "./utils/talibInit";

// Prefer loading TA-Lib WASM early so indicators are ready when user opens a chart
ensureTalib().catch((err) => console.warn("TA-Lib load failed:", err));

createRoot(document.getElementById("root")!).render(<App />);
