import './style.css';

import { createGeneratorPage } from './generator';
import { createViewerPage } from './viewer';

interface Page {
  id: string;
  label: string;
  root: HTMLElement;
  activate(): void;
  deactivate(): void;
}

interface PageWithButton extends Page {
  button?: HTMLButtonElement;
}

const app = document.getElementById('app');
if (!app) {
  throw new Error('Root element not found');
}

const nav = document.createElement('nav');
nav.className = 'app-nav';

const container = document.createElement('div');
container.className = 'page-container';

const viewer = createViewerPage();
const generator = createGeneratorPage();

const pages: PageWithButton[] = [
  { id: 'viewer', label: 'Просмотр карт', ...viewer },
  { id: 'generator', label: 'Генератор JSON', ...generator },
];

let currentPage: PageWithButton | null = null;

for (const page of pages) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = page.label;
  button.className = 'nav-button';
  button.addEventListener('click', () => switchTo(page));
  nav.appendChild(button);
  page.button = button;
}

function switchTo(page: PageWithButton): void {
  if (currentPage?.id === page.id) {
    return;
  }
  if (currentPage) {
    currentPage.deactivate();
    container.innerHTML = '';
    if (currentPage.button) {
      currentPage.button.classList.remove('active');
    }
  }
  container.appendChild(page.root);
  page.activate();
  if (page.button) {
    page.button.classList.add('active');
  }
  currentPage = page;
}

app.append(nav, container);

switchTo(pages[0]!);
