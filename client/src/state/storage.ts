export interface LocalUser {
  email: string;
  login: string;
  password: string;
}

export interface SessionData {
  nick: string;
}

export interface CharacterData {
  name: string;
  gender: "male" | "female" | "other";
  special: Record<string, number>;
}

const USER_KEY = "tla:user";
const SESSION_KEY = "tla:session";
const CHARACTER_KEY = "tla:character";

export function saveUser(user: LocalUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): LocalUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalUser;
  } catch (err) {
    console.warn("не удалось разобрать пользователя", err);
    return null;
  }
}

export function saveSession(session: SessionData | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): SessionData | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch (err) {
    console.warn("не удалось разобрать сессию", err);
    return null;
  }
}

export function saveCharacter(data: CharacterData): void {
  localStorage.setItem(CHARACTER_KEY, JSON.stringify(data));
}

export function getCharacter(): CharacterData | null {
  const raw = localStorage.getItem(CHARACTER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CharacterData;
  } catch (err) {
    console.warn("не удалось разобрать персонажа", err);
    return null;
  }
}
