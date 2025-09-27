import "./styles/global.css";
import { Router } from "./router";
import { renderLogin } from "./screens/login";
import { renderRegister } from "./screens/register";
import { renderCharacterCreation } from "./screens/character";
import { renderPlay } from "./screens/play";
import { renderFrDemo } from "./screens/fr-demo";
import { renderAssetGallery } from "./screens/asset-gallery";
import { getSession } from "./state/storage";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Не найден корневой элемент #app");
}

const router = new Router(root);

router.register("/", ({ navigate }) => {
  const session = getSession();
  if (session) {
    navigate("/play", true);
  } else {
    navigate("/auth/login", true);
  }
});

router.register("/auth/login", renderLogin);
router.register("/auth/register", renderRegister);
router.register("/char/new", renderCharacterCreation);
router.register("/play", renderPlay);
router.register("/tools/fr-demo", renderFrDemo);
router.register("/tools/assets", renderAssetGallery);
router.register("/404", ({ container }) => {
  const main = document.createElement("main");
  main.className = "screen";
  const message = document.createElement("div");
  message.className = "pip-card";
  const title = document.createElement("h1");
  title.textContent = "Страница не найдена";
  const home = document.createElement("button");
  home.textContent = "Перейти к входу";
  home.addEventListener("click", () => router.navigate("/auth/login"));
  message.append(title, home);
  main.appendChild(message);
  container.appendChild(main);
});

router.start();

window.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.tagName === "A") {
    const href = (target as HTMLAnchorElement).getAttribute("href");
    if (href && href.startsWith("/")) {
      event.preventDefault();
      router.navigate(href);
    }
  }
});
