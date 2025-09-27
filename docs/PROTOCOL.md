# Протокол WebSocket

Обмен в реальном времени организован через простой JSON-протокол между клиентом и сервером. Сообщения соответствуют типам из пакета `@tla/shared`.

## Клиент → Сервер

```ts
type ClientMsg =
  | { type: "join"; room: "demo"; nick: string; build: string }
  | { type: "move"; to: Hex };
```

- `join` — подключает игрока к комнате `demo`. Сервер отвечает снимком состояния `hello`.
- `move` — запрашивает перемещение аватара в указанную клетку (проверяется на сервере).

## Сервер → Клиент

```ts
type ServerMsg =
  | { type: "hello"; you: string; room: string; map: MapJSON; players: Record<string, Hex> }
  | { type: "player-joined"; id: string; pos: Hex }
  | { type: "player-moved"; id: string; to: Hex }
  | { type: "player-left"; id: string };
```

- `hello` — отправляется после успешного входа и содержит авторитетную карту и текущие позиции игроков.
- `player-joined` — в комнату вошёл новый игрок.
- `player-moved` — аватар переместился в клетку; сообщение рассылается всем, включая инициатора.
- `player-left` — игрок отключился от комнаты.

Все сообщения кодируются в виде JSON-объектов UTF-8.
