import { getCharacter, getSession, saveCharacter } from "../state/storage";
import type { RouteContext } from "../router";

const SPECIAL_STATS = [
  "Сила",
  "Восприятие",
  "Выносливость",
  "Харизма",
  "Интеллект",
  "Ловкость",
  "Удача",
] as const;

export function renderCharacterCreation({ container, navigate }: RouteContext): void {
  const session = getSession();
  if (!session) {
    navigate("/auth/login");
    return;
  }

  const existing = getCharacter();

  const main = document.createElement("main");
  main.className = "screen";

  const card = document.createElement("div");
  card.className = "character-card pip-panel";

  const title = document.createElement("h1");
  title.textContent = "Настройка профиля жителя";
  card.appendChild(title);

  const form = document.createElement("form");

  const error = document.createElement("div");
  error.className = "pip-error";

  const nameField = document.createElement("label");
  nameField.textContent = "Имя";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = existing?.name ?? "";
  nameInput.placeholder = "Житель Убежища";
  nameField.appendChild(nameInput);

  const genderRow = document.createElement("div");
  genderRow.className = "form-row";
  const genders: Array<{ label: string; value: "male" | "female" | "other" }> = [
    { label: "Мужской", value: "male" },
    { label: "Женский", value: "female" },
    { label: "Другое", value: "other" },
  ];
  let selectedGender = existing?.gender ?? "male";
  genders.forEach(({ label, value }) => {
    const wrapper = document.createElement("label");
    wrapper.style.flexDirection = "row";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "0.4rem";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "gender";
    input.value = value;
    if (value === selectedGender) input.checked = true;
    input.addEventListener("change", () => {
      selectedGender = value;
    });
    wrapper.append(input, document.createTextNode(label));
    genderRow.appendChild(wrapper);
  });

  const specialContainer = document.createElement("div");
  specialContainer.className = "special-grid";

  const stats: Record<string, number> = {};
  SPECIAL_STATS.forEach((stat) => {
    stats[stat] = existing?.special?.[stat] ?? 5;
  });

  const totalLimit = 40;
  const totalLabel = document.createElement("div");
  totalLabel.textContent = `Доступно очков: ${totalLimit - currentTotal(stats)}`;
  totalLabel.className = "pip-subtitle";

  const sliders: Record<string, HTMLInputElement> = {};
  const valueLabels: Record<string, HTMLSpanElement> = {};

  SPECIAL_STATS.forEach((stat) => {
    const panel = document.createElement("div");
    panel.className = "section";
    const label = document.createElement("div");
    label.textContent = stat;
    const sliderRow = document.createElement("div");
    sliderRow.className = "slider-row";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "1";
    slider.max = "10";
    slider.value = String(stats[stat]);
    slider.step = "1";
    const valueLabel = document.createElement("span");
    valueLabel.textContent = slider.value;
    sliderRow.append(slider, valueLabel);
    panel.append(label, sliderRow);
    specialContainer.appendChild(panel);
    sliders[stat] = slider;
    valueLabels[stat] = valueLabel;

    slider.addEventListener("input", () => {
      const proposed = { ...stats, [stat]: Number(slider.value) };
      if (currentTotal(proposed) > totalLimit) {
        slider.value = String(stats[stat]);
        return;
      }
      stats[stat] = Number(slider.value);
      valueLabel.textContent = slider.value;
      totalLabel.textContent = `Доступно очков: ${totalLimit - currentTotal(stats)}`;
    });
  });

  const controls = document.createElement("div");
  controls.className = "form-row";
  controls.style.justifyContent = "flex-end";

  const back = document.createElement("button");
  back.type = "button";
  back.className = "secondary";
  back.textContent = "Назад";
  back.addEventListener("click", () => navigate("/auth/login"));

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Подтвердить";

  controls.append(back, submit);

  form.append(error, nameField, genderRow, totalLabel, specialContainer, controls);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.textContent = "";
    if (!nameInput.value.trim()) {
      error.textContent = "Введите имя персонажа";
      return;
    }
    if (currentTotal(stats) > totalLimit) {
      error.textContent = "Количество очков превышает лимит";
      return;
    }
    saveCharacter({
      name: nameInput.value.trim(),
      gender: selectedGender,
      special: { ...stats },
    });
    navigate("/play");
  });

  card.append(form);
  main.appendChild(card);
  container.appendChild(main);
}

function currentTotal(stats: Record<string, number>): number {
  return Object.values(stats).reduce((sum, value) => sum + value, 0);
}
