import { GameClient } from "../game/gameClient";
import { getCharacter, getSession, saveSession } from "../state/storage";
import type { RouteContext } from "../router";

export function renderPlay({ container, navigate }: RouteContext): () => void {
  const session = getSession();
  if (!session) {
    navigate("/auth/login");
    return () => {};
  }
  const character = getCharacter();
  if (!character) {
    navigate("/char/new");
    return () => {};
  }

  const screen = document.createElement("div");
  screen.className = "play-screen";
  container.appendChild(screen);

  const toolbar = document.createElement("div");
  toolbar.className = "play-toolbar";
  screen.appendChild(toolbar);

  const logoutButton = document.createElement("button");
  logoutButton.type = "button";
  logoutButton.textContent = "Выйти из аккаунта";
  toolbar.appendChild(logoutButton);

  const root = document.createElement("div");
  root.className = "game-root";
  screen.appendChild(root);

  const client = new GameClient({ root, nick: session.nick });
  void client.init();

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    client.destroy();
    screen.remove();
  };

  logoutButton.addEventListener("click", () => {
    saveSession(null);
    dispose();
    navigate("/auth/login");
  });

  return () => {
    dispose();
  };
}
