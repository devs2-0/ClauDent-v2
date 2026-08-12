import { createRoot } from "react-dom/client";
import App from "@/app/App";
import "./index.css";

const showDeveloperConsoleWarning = () => {
  const title = "ALTO";
  const message = [
    "Esta consola es una herramienta para desarrolladores.",
    "Si alguien te pidio copiar o pegar codigo aqui, podria robar tu sesion o modificar informacion sensible.",
    "Cierra esta ventana si no sabes exactamente que estas haciendo.",
  ].join("\n");

  console.log(`%c${title}`, "color:#dc2626;font-size:48px;font-weight:800;");
  console.log(`%c${message}`, "color:#111827;font-size:16px;font-weight:600;line-height:1.5;");
};

showDeveloperConsoleWarning();

createRoot(document.getElementById("root")!).render(<App />);
