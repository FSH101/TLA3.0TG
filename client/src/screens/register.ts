import { saveSession, saveUser } from "../state/storage";
import type { RouteContext } from "../router";

export function renderRegister({ container, navigate }: RouteContext): void {
  const main = document.createElement("main");
  main.className = "screen";

  const card = document.createElement("div");
  card.className = "pip-card";

  const title = document.createElement("h1");
  title.textContent = "Регистрация нового жителя";
  card.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "pip-subtitle";
  subtitle.textContent = "Отправьте данные для переписи Vault-Tec.";
  card.appendChild(subtitle);

  const form = document.createElement("form");
  const error = document.createElement("div");
  error.className = "pip-error";

  const emailLabel = createField("Электронная почта", "email", "email");
  const loginLabel = createField("Логин", "text", "login");
  const passLabel = createField("Пароль", "password", "password");
  const confirmLabel = createField("Повторите пароль", "password", "confirm");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Зарегистрироваться";

  const backLink = document.createElement("button");
  backLink.type = "button";
  backLink.className = "secondary";
  backLink.textContent = "Вернуться к терминалу";
  backLink.addEventListener("click", () => navigate("/auth/login"));

  form.append(emailLabel, loginLabel, passLabel, confirmLabel, submit, backLink);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.textContent = "";
    const email = getValue(emailLabel);
    const login = getValue(loginLabel);
    const password = getValue(passLabel);
    const confirm = getValue(confirmLabel);

    if (!email || !login || !password || !confirm) {
      error.textContent = "Заполните все поля";
      return;
    }
    if (password.length < 6) {
      error.textContent = "Пароль должен содержать не менее 6 символов";
      return;
    }
    if (password !== confirm) {
      error.textContent = "Пароли не совпадают";
      return;
    }
    saveUser({ email, login, password });
    saveSession({ nick: login });
    navigate("/char/new");
  });

  card.append(error, form);
  main.appendChild(card);
  container.appendChild(main);
}

function createField(label: string, type: string, name: string): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const input = document.createElement("input");
  input.type = type;
  input.name = name;
  input.required = true;
  wrapper.appendChild(input);
  return wrapper;
}

function getValue(label: HTMLLabelElement): string {
  const input = label.querySelector("input");
  return input ? input.value.trim() : "";
}
