type Cleanup = () => void;

type ScreenRenderer = (context: RouteContext) => Cleanup | void;

export interface RouteContext {
  container: HTMLElement;
  navigate: (path: string) => void;
}

export class Router {
  private readonly routes = new Map<string, ScreenRenderer>();
  private cleanup: Cleanup | null = null;

  constructor(private readonly container: HTMLElement) {
    window.addEventListener("popstate", () => this.render(window.location.pathname));
  }

  register(path: string, renderer: ScreenRenderer): void {
    this.routes.set(path, renderer);
  }

  start(): void {
    this.render(window.location.pathname);
  }

  navigate(path: string, replace = false): void {
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    this.render(path);
  }

  private render(path: string): void {
    const renderer = this.routes.get(path) ?? this.routes.get("/404");
    if (!renderer) {
      console.error("Нет обработчика маршрута", path);
      return;
    }
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
    this.container.innerHTML = "";
    const cleanup = renderer({ container: this.container, navigate: (to) => this.navigate(to) });
    if (cleanup) {
      this.cleanup = cleanup;
    }
  }
}
