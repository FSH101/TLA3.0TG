import "./styles.css";
import { GameWorld } from '@engine';
import { TimeEventContext, TimeEventPayload } from '@systems';
import { CritterCondition, ItemType, Item } from '@models';
import { derivedStats, primaryStats } from '@data';

const app = document.getElementById('app');

async function bootstrap() {
  if (!app) {
    throw new Error('Application root is missing');
  }

  const world = new GameWorld();
  await world.initialize();

  const demoMap = world.createMap({ protoId: 100, name: 'Demo Map', width: 200, height: 200 });
  const location = world.createLocation({ protoId: 10, name: 'Demo Location', worldX: 12, worldY: 42 });
  world.attachMapToLocation(location.id, demoMap.id);

  const stats: Record<string, number> = {};
  for (const def of [...primaryStats, ...derivedStats]) {
    stats[def.id] = def.base;
  }

  const critter = world.registerCritter({
    protoId: 500,
    name: 'Browser Dweller',
    mapId: demoMap.id,
    hexX: 100,
    hexY: 100,
    direction: 0,
    stats,
  });

  const pistol = world.createItem({ protoId: 2000, type: ItemType.Weapon, amount: 1 });
  world.moveItemToCritter(pistol.id, critter.id);

  world.registerTimeEventHandler('heartbeat', (_: TimeEventPayload, ctx: TimeEventContext) => {
    const now = new Date(ctx.worldTime);
    const heartbeatNode = document.getElementById('heartbeat');
    if (heartbeatNode) {
      heartbeatNode.textContent = `Last heartbeat at ${now.toLocaleTimeString()}`;
    }
  });

  world.createTimeEvent(critter.id, 'heartbeat', 1000, [], true);

  world.radioMessage(0, 'TLAMK2 web prototype initialized.');

  renderWorld(app, world);
}

function renderWorld(root: HTMLElement, world: GameWorld) {
  const critters = world.getAllCritters();
  const maps = world.getAllMaps();
  const locations = world.getAllLocations();

  const [firstCritter] = critters;

  root.innerHTML = `
    <section class="summary">
      <h1>TLAMK2 Web Engine Prototype</h1>
      <p id="heartbeat">Preparing heartbeat...</p>
      <h2>World Snapshot</h2>
      <ul>
        <li><strong>Critters:</strong> ${critters.length}</li>
        <li><strong>Items:</strong> ${world.getAllItems().length}</li>
        <li><strong>Maps:</strong> ${maps.length}</li>
        <li><strong>Locations:</strong> ${locations.length}</li>
      </ul>
      ${renderCritterDetails(firstCritter)}
    </section>
  `;
}

function renderCritterDetails(critter?: ReturnType<GameWorld['getCritter']>): string {
  if (!critter) {
    return '<p>No critters registered yet.</p>';
  }

  const inventoryItems = critter.listItems();
  const statsList = Object.entries(critter.stats)
    .map(([key, value]) => `<li><strong>${key}</strong>: ${value}</li>`)
    .join('');

  const inventoryList = inventoryItems
    .map((item: Item) => `<li>Item #${item.id} (proto ${item.protoId}) – type ${ItemType[item.type]}</li>`)
    .join('');

  return `
    <article class="critter">
      <h3>${critter.name}</h3>
      <p>Condition: ${CritterCondition[critter.condition]}</p>
      <p>Position: map ${critter.position.mapId} @ ${critter.position.hexX}:${critter.position.hexY}</p>
      <h4>Stats</h4>
      <ul class="stats">${statsList}</ul>
      <h4>Inventory</h4>
      <ul class="inventory">${inventoryList || '<li>Empty</li>'}</ul>
    </article>
  `;
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap TLAMK2 web engine', error);
  if (app) {
    app.innerHTML = `<pre>${String(error)}</pre>`;
  }
});
