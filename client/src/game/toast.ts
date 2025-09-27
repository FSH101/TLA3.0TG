export class ToastManager {
  private container: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.container = document.createElement("div");
    this.container.className = "toast-container";
    parent.appendChild(this.container);
  }

  push(message: string): void {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("fade-out");
      toast.addEventListener("transitionend", () => toast.remove(), { once: true });
      toast.style.opacity = "0";
    }, 3000);
  }
}
