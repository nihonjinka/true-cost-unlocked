import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest(".interactive-button");
  if (!(button instanceof HTMLElement)) return;

  const rect = button.getBoundingClientRect();
  const ripple = document.createElement("span");
  const size = Math.max(rect.width, rect.height) * 1.2;

  ripple.className = "ripple-wave";
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;

  button.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
});

createRoot(document.getElementById("root")!).render(<App />);
