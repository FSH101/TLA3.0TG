import { GameClient } from "../game/gameClient";
import { getCharacter, getSession } from "../state/storage";
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

  const root = document.createElement("div");
  root.className = "game-root";
  container.appendChild(root);

  const client = new GameClient({ root, nick: session.nick });
  void client.init();

  return () => {
    client.destroy();
  };
}
