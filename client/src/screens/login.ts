import { getCharacter, getSession, getUser, saveSession } from "../state/storage";
import type { RouteContext } from "../router";

export function renderLogin({ container, navigate }: RouteContext): void {
  const session = getSession();
  if (session) {
    navigate("/play");
    return;
  }

  const main = document.createElement("main");
  main.className = "screen";

  const card = document.createElement("div");
  card.className = "pip-card";

  const title = document.createElement("h1");
  title.textContent = "Терминал Vault-Tec";
  card.appendChild(title);

  const description = document.createElement("p");
  description.className = "pip-subtitle";
  description.textContent = "Доступ только для авторизованных жителей.";
  card.appendChild(description);

  const form = document.createElement("form");
  const error = document.createElement("div");
  error.className = "pip-error";

  const loginLabel = document.createElement("label");
  loginLabel.textContent = "Email или логин";
  const loginInput = document.createElement("input");
  loginInput.type = "text";
  loginInput.name = "login";
  loginInput.placeholder = "Житель";
  loginLabel.appendChild(loginInput);

  const passwordLabel = document.createElement("label");
  passwordLabel.textContent = "Пароль";
  const passwordInput = document.createElement("input");
  passwordInput.type = "password";
  passwordInput.name = "password";
  passwordInput.placeholder = "••••••";
  passwordLabel.appendChild(passwordInput);

  const rememberRow = document.createElement("div");
  rememberRow.className = "inline-actions";
  const rememberLabel = document.createElement("label");
  rememberLabel.style.flexDirection = "row";
  rememberLabel.style.alignItems = "center";
  rememberLabel.style.gap = "0.5rem";
  const rememberCheckbox = document.createElement("input");
  rememberCheckbox.type = "checkbox";
  rememberCheckbox.name = "remember";
  rememberLabel.appendChild(rememberCheckbox);
  const rememberText = document.createElement("span");
  rememberText.textContent = "Оставаться в системе";
  rememberLabel.appendChild(rememberText);

  const registerLink = document.createElement("a");
  registerLink.href = "/auth/register";
  registerLink.textContent = "Зарегистрировать нового жителя";
  registerLink.addEventListener("click", (event) => {
    event.preventDefault();
    navigate("/auth/register");
  });

  rememberRow.appendChild(rememberLabel);
  rememberRow.appendChild(registerLink);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Авторизоваться";

  form.append(loginLabel, passwordLabel, rememberRow, submit);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.textContent = "";
    const loginValue = loginInput.value.trim();
    const passwordValue = passwordInput.value.trim();
    if (!loginValue || !passwordValue) {
      error.textContent = "Введите логин и пароль";
      return;
    }
    const user = getUser();
    if (!user) {
      error.textContent = "Пользователь не найден";
      return;
    }
    if (
      (user.login !== loginValue && user.email !== loginValue) ||
      user.password !== passwordValue
    ) {
      error.textContent = "Неверные учётные данные";
      return;
    }
    saveSession({ nick: user.login });
    const character = getCharacter();
    if (character) {
      navigate("/play");
    } else {
      navigate("/char/new");
    }
  });

  card.append(error, form);
  main.appendChild(card);
  container.appendChild(main);
}
