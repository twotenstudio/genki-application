// Turns the page into the island map, and back. The page itself stays the source of truth:
// islands come from the nav links, and each landing opens the matching <section> as a panel.

import { Game } from './game';
import { isIslandId, layout, type Island, type IslandId } from './islands';

const html = document.documentElement;
const STORAGE_KEY = 'view';
const WIDE = matchMedia('(min-width: 40rem)');

function saveView(view: 'map' | 'page') {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Storage can be blocked. The choice just won't be remembered.
  }
}

function init() {
  const world = document.querySelector<HTMLElement>('[data-world]');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-world-canvas]');
  const intro = document.querySelector<HTMLElement>('[data-intro]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-view-toggle]');
  const startButton = document.querySelector<HTMLButtonElement>('[data-game-start]');
  const landButton = document.querySelector<HTMLButtonElement>('[data-land]');
  const announcer = document.querySelector<HTMLElement>('[data-announce]');
  if (!world || !canvas || !intro || !toggle || !startButton || !landButton) return;

  const links = [...world.querySelectorAll<HTMLAnchorElement>('a[data-island]')];
  const islands: Island[] = links.flatMap((link) => {
    const id = link.dataset['island'];
    if (!isIslandId(id)) return [];
    return [
      {
        ...layout[id],
        id,
        label: link.dataset['label'] ?? '',
        number: link.dataset['number'] ?? '',
      },
    ];
  });
  const sections = new Map(
    [...document.querySelectorAll<HTMLElement>('[data-island-section]')].map(
      (element): [string, HTMLElement] => [element.id, element],
    ),
  );
  const labelOf = (id: IslandId) => islands.find((island) => island.id === id)?.label ?? id;

  let game: Game | null = null;
  let openSection: string | null = null;
  let returnFocus: HTMLElement | null = null;

  const announce = (message: string) => {
    if (!announcer) return;
    announcer.textContent = '';
    requestAnimationFrame(() => {
      announcer.textContent = message;
    });
  };

  const setCurrent = (id: IslandId | null) => {
    for (const link of links) {
      if (link.dataset['island'] === id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };

  /** Keeps the plane centred in the part of the map a panel doesn't cover. */
  const updateInset = () => {
    const panel = openSection
      ? sections.get(openSection)
      : intro.hasAttribute('data-dismissed')
        ? null
        : intro;
    if (!game) return;
    if (!panel || !html.classList.contains('game')) {
      game.setInset(0, 0);
      return;
    }
    const rect = panel.getBoundingClientRect();
    if (WIDE.matches) game.setInset(Math.max(0, window.innerWidth - rect.left), 0);
    else game.setInset(0, Math.max(0, window.innerHeight - rect.top));
  };

  const showIntro = () => {
    intro.removeAttribute('data-dismissed');
    setCurrent('home');
    requestAnimationFrame(updateInset);
  };

  const hideIntro = () => {
    if (intro.hasAttribute('data-dismissed')) return;
    intro.setAttribute('data-dismissed', '');
    requestAnimationFrame(updateInset);
  };

  const openPanel = (id: string) => {
    const section = sections.get(id);
    if (!section) return;
    hideIntro();
    section.setAttribute('data-open', '');
    section.setAttribute('role', 'dialog');
    section.setAttribute('aria-modal', 'true');
    world.inert = true;
    intro.inert = true;
    html.dataset['panel'] = id;
    openSection = id;
    if (isIslandId(id)) setCurrent(id);
    history.replaceState(null, '', `#${id}`);
    game?.setInputEnabled(false);
    section.scrollTop = 0;
    section.querySelector<HTMLElement>('h2')?.focus();
    requestAnimationFrame(updateInset);
  };

  const closePanel = ({ takeOff = true, restoreFocus = true } = {}) => {
    if (!openSection) return;
    const section = sections.get(openSection);
    section?.removeAttribute('data-open');
    section?.removeAttribute('role');
    section?.removeAttribute('aria-modal');
    world.inert = false;
    intro.inert = false;
    delete html.dataset['panel'];
    openSection = null;
    setCurrent(null);
    history.replaceState(null, '', location.pathname + location.search);
    game?.setInputEnabled(true);
    game?.setInset(0, 0);
    if (takeOff) game?.takeOff();
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  };

  const onLand = (id: IslandId) => {
    if (id === 'home') {
      showIntro();
      intro.querySelector<HTMLElement>('h1')?.focus();
      return;
    }
    announce(`Landed on ${labelOf(id)}.`);
    openPanel(id);
  };

  const onNear = (id: IslandId | null) => {
    landButton.hidden = id === null;
    if (id === null) return;
    landButton.textContent = `Land on ${labelOf(id)}`;
    announce(`${labelOf(id)} is below you. Press Enter to land.`);
  };

  const createGame = () =>
    new Game(canvas, islands, {
      paletteSource: world,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      onLand,
      onNear,
      onTakeOff: () => {
        hideIntro();
        setCurrent(null);
      },
    });

  const enterMap = (fromToggle: boolean) => {
    html.classList.add('game');
    try {
      game ??= createGame();
    } catch {
      // No canvas support: stay on the page.
      html.classList.remove('game');
      return;
    }
    game.start();
    html.classList.add('game-ready');
    const hash = location.hash.slice(1);
    if (fromToggle) {
      game.parkAt('home');
      hideIntro();
      game.takeOff();
      announce('You are flying. Choose an island from the list, or use the arrow keys.');
    } else if (sections.has(hash) && isIslandId(hash)) {
      game.parkAt(hash);
      openPanel(hash);
    } else {
      game.parkAt('home');
      showIntro();
    }
  };

  const enterPage = () => {
    const wasOpen = openSection;
    closePanel({ takeOff: false, restoreFocus: false });
    html.classList.remove('game', 'game-ready');
    intro.removeAttribute('data-dismissed');
    game?.stop();
    landButton.hidden = true;
    if (wasOpen) document.getElementById(wasOpen)?.scrollIntoView();
    else window.scrollTo(0, 0);
  };

  for (const link of links) {
    link.addEventListener('click', (event) => {
      const id = link.dataset['island'];
      if (!game || !html.classList.contains('game') || !isIslandId(id)) return;
      event.preventDefault();
      returnFocus = link;
      if (id !== 'home') announce(`Flying to ${labelOf(id)}.`);
      game.flyTo(id);
    });
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-island-close]')) {
    button.addEventListener('click', () => {
      closePanel();
    });
  }

  startButton.addEventListener('click', () => {
    hideIntro();
    game?.takeOff();
    announce('You are flying. Choose an island from the list, or use the arrow keys.');
    links.find((link) => link.dataset['island'] !== 'home')?.focus();
  });

  landButton.addEventListener('click', () => {
    game?.landNearby();
  });

  toggle.addEventListener('click', () => {
    if (html.classList.contains('game')) {
      saveView('page');
      enterPage();
    } else {
      saveView('map');
      enterMap(true);
    }
    toggle.focus();
  });
  toggle.hidden = false;

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openSection) {
      event.preventDefault();
      closePanel();
    }
  });

  window.addEventListener('resize', () => {
    requestAnimationFrame(updateInset);
  });

  if (html.classList.contains('game')) enterMap(false);
}

init();
