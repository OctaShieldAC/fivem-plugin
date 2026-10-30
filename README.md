# OCTA Shield server interface

Public server-side interface of the `octashield` resource: exports, commands,
convars, ACEs, player state, local events and the rules that decide who must
run the anti-cheat. Client, NUI and internal protocol are out of scope.

## Conventions

- Exports never throw. Every export returns a table/object:
  - success: `{ ok = true, ...data }`
  - failure: `{ ok = false, error = "<code>" }`
- Error codes (`OctashieldExportError`):
  - `permission_denied`: the `author` lacks the required ACE.
  - `player_not_found`: the source or target is not connected.
  - `invalid_identifier`: the identifier is malformed or its prefix is not in `octashield_acceptable_identifiers`.
  - `internal_error`: an unexpected exception; logged without details.
- `null` in JavaScript is `nil` in Lua. Object fields and array items map to table fields and 1-indexed lists.
- `source` values are numbers. Exports also accept a numeric string.
- No value is a BigInt. Identifiers are strings; the Steam64 conversion is internal.

Lua calls use `:`, JavaScript calls use `.`:

```lua
local result = exports.octashield:getPlayerState(source)
```

```js
const result = exports.octashield.getPlayerState(source);
```

## Exports

`author` is optional. Omitted, `nil` or `null` means the calling resource is
trusted (it is the resource's responsibility). When given, it must be `0`
(console) or a player source that has the export's ACE; otherwise the result
is `permission_denied`.

| Export | Arguments | Result | ACE |
| --- | --- | --- | --- |
| `getPlayerState` | `source, author?` | `{ ok, player }` | `octashield.read` |
| `getPlayers` | `author?` | `{ ok, players }` | `octashield.read` |
| `kickPlayer` | `source, author?` | `{ ok }` | `octashield.kick` |
| `addWhitelist` | `target, author?` | `{ ok }` | `octashield.whitelist` |
| `removeWhitelist` | `target, author?` | `{ ok }` | `octashield.whitelist` |
| `listWhitelist` | `author?` | `{ ok, identifiers }` | `octashield.read` |
| `isWhitelisted` | `target, author?` | `{ ok, whitelisted }` | `octashield.read` |
| `addRequired` | `target, author?` | `{ ok }` | `octashield.whitelist` |
| `removeRequired` | `target, author?` | `{ ok }` | `octashield.whitelist` |
| `listRequired` | `author?` | `{ ok, identifiers }` | `octashield.read` |
| `isRequired` | `target, author?` | `{ ok, required }` | `octashield.read` |

Details:

- **`getPlayerState(source)`**: `player` is `nil` (`null`) when the source is
  unknown, not a number, or not connected. Otherwise it is a `PlayerState`.
- **`getPlayers()`**: `players` lists every connected, tracked player, sorted by source.
- **`kickPlayer(source)`**: accepts a connected numeric source only; otherwise
  `player_not_found`. It ignores fail-open, `kickDisabled`,
  `octashield_kick_enabled` and the whitelists. It always works.
- **`addWhitelist(target)` / `removeWhitelist(target)`**: `target` is a
  connected numeric source or an identifier string `prefix:value`.
  - A source resolves to that player's own identifier (the one the server
    chose at admission), not all of them.
  - `add` checks the prefix against `octashield_acceptable_identifiers`
    (`invalid_identifier`). `remove` does not check the prefix.
  - Adding an identifier already present, or removing one absent, returns
    `{ ok = true }` and emits no event.
- **`listWhitelist()`**: the local whitelist, as stored (lowercase identifiers).
- **`isWhitelisted(target)`**:
  - `whitelisted` is `"none"`, `"global"` or `"local"`.
  - A source is checked against all of the player's identifiers. An identifier string is checked alone.
  - Precedence: `global` (EMAC's whitelist) over `local`, for any identifier.
  - A numeric target must be connected (`player_not_found`).
- **`addRequired` / `removeRequired` / `listRequired` / `isRequired`**: same
  target rules and prefix checks as the whitelist. The required list only
  matters in `global` whitelist mode (see Decision rules).

Example (Lua, resource calling its own admin tool with a player as author):

```lua
local octashield = exports.octashield --[[@as OctashieldExports]]

local result = octashield:getPlayerState(source, author)
if not result.ok then
  print(result.error)
elseif result.player then
  print(result.player.state, result.player.kickApplies)
end
```

Example (JavaScript):

```js
const result = exports.octashield.getPlayerState(source);
if (result.ok && result.player) {
  console.log(result.player.state, result.player.kickApplies);
}
```

## Commands

All subcommands live under `octashield`. The command itself is not restricted
by FiveM: each subcommand checks its own ACE. The console (source `0`) always
may. Subcommand names are case-insensitive. Unknown or missing subcommands,
and wrong argument counts, print the usage.

| Command | ACE | Notes |
| --- | --- | --- |
| `octashield status [source]` | `octashield.read` | Replies with the whitelist mode, then players. With no players: `No players connected`. Takes at most one argument. |
| `octashield kick <source>` | `octashield.kick` | Same as `kickPlayer`. |
| `octashield whitelist add <source\|identifier>` | `octashield.whitelist` | Same as `addWhitelist`. |
| `octashield whitelist remove <source\|identifier>` | `octashield.whitelist` | Same as `removeWhitelist`. |
| `octashield whitelist list` | `octashield.read` | Same as `listWhitelist`. |
| `octashield required add <source\|identifier>` | `octashield.whitelist` | Same as `addRequired`. |
| `octashield required remove <source\|identifier>` | `octashield.whitelist` | Same as `removeRequired`. |
| `octashield required list` | `octashield.read` | Same as `listRequired`. |
| `octashield_version` | none (public) | Prints the resource version. |

Output: the console gets English text prefixed with the log tag. A player gets
the reply in chat (`chat:addMessage`) in the player's language. A player
without the ACE gets `You are not allowed to use this command`.

## Server configuration

### ACEs

Grant the ACEs in `server.cfg` to groups or principals:

```
add_ace group.moderator octashield.read allow
add_ace group.moderator octashield.kick allow
add_ace group.admin octashield.whitelist allow
add_principal identifier.steam:110000112345678 group.admin
```

| ACE | Allows |
| --- | --- |
| `octashield.read` | Reading state, players, whitelists and required lists, and `status`. Needed to learn whether a player can be kicked. |
| `octashield.kick` | Manual kick. |
| `octashield.whitelist` | Changing the local whitelist and the required list. |

Exports called without `author` are not checked against ACEs.

### Convars

| Convar | Default | Meaning |
| --- | --- | --- |
| `octashield_project_alias` | `""` | Sent to clients as `server` when a session starts. Empty reports an error at start (see `octashield_error_reporting`). |
| `octashield_project_secret` | `""` | Server token issued by emac-token-api. Empty reports an error at start (see `octashield_error_reporting`). **Secret: never log it, never publish it, never use `sets`, never commit `server.cfg`.** |
| `octashield_kick_enabled` | `1` | `0` turns off the heartbeat kick locally. Any other value leaves it on. It never forces the kick on over the backend's `kickDisabled`. |
| `octashield_acceptable_identifiers` | `steam:;` (fallback `steam:`) | Semicolon-separated identifier prefixes accepted by `add` for whitelist and required list. Empty entries are dropped. If nothing remains, `steam:` is used. |
| `octashield_language` | `auto` | `pt`, `en` or `es` forces that language for everyone. `auto`, or any other value, uses each player's FiveM game language, reported by the client and remembered per Rockstar license for later connections. Before any report (first connection), English is used. |
| `octashield_whitelist_mode` | `selected` | `selected` or `global` (see Decision rules). Trimmed and lowercased. An invalid value keeps the last valid mode (`selected` if never read) and is logged once per value. |
| `octashield_error_reporting` | `file` | Where handled errors go: `file` (the resource's `logs/errors.jsonl`), `sentry` or `both`. Trimmed and lowercased; any other value is `file`. Only `sentry` and `both` send to Sentry. |

The resource also reads the FXServer convar `netPort` to know the server port.
It is not a plugin setting.

Example:

```
set octashield_project_alias "<project alias>"
set octashield_project_secret "<server token>"
set octashield_kick_enabled 1
set octashield_acceptable_identifiers "steam:"
set octashield_language auto
set octashield_whitelist_mode selected
set octashield_error_reporting file
```

## Player state

`PlayerState` (the object returned by `getPlayerState` and `getPlayers`):

| Field | Type | Meaning |
| --- | --- | --- |
| `source` | number | Server id. |
| `state` | `"connecting"` \| `"waiting"` \| `"active"` \| `"expired"` | See below. |
| `identifier` | string | Identifier used for whitelist and required checks. |
| `whitelisted` | `"none"` \| `"global"` \| `"local"` | Whitelist origin. |
| `required` | boolean | The anti-cheat is required for this player. |
| `kickApplies` | boolean | The heartbeat kick applies now (see below). |
| `validUntil` | number | Deadline of the heartbeat window, epoch ms. |
| `lastHeartbeatAt` | number \| `nil` | Last valid heartbeat, epoch ms. `nil`/`null` if none. |

States:

- `connecting`: admitted, no `CLIENT_READY` yet.
- `waiting`: session started, no valid heartbeat yet.
- `active`: a valid heartbeat is within the deadline.
- `expired`: past the deadline while the kick does not apply. When the kick
  applies again, the player goes back to `waiting`/`connecting` until the next action.

`kickApplies` is true only when all of these hold: the heartbeat kick is
enabled (convar and backend `kickDisabled`), the server is ready (secrets
loaded), the backend is reachable, EMAC's global whitelist flag is off, and
the player is required.

## Decision rules

Order of evaluation for "is this player required":

1. **Banned** players are refused at admission and kicked (`banned`) only while the backend responds. Bans come before whitelists. Under fail-open (backend unreachable), bans are not enforced.
2. **Whitelisted** players (EMAC global or local whitelist, any of their
   identifiers) are dispensed in both modes.
3. **`selected`** mode: every other player is required. The required list is ignored.
4. **`global`** mode: only players on the required list are required.

| Player | `selected` | `global` |
| --- | --- | --- |
| Whitelisted (global or local) | not required | not required |
| On the required list, not whitelisted | required | required |
| Neither list | required | not required |

Enforcement:

- Admission is refused with `ANTICHEAT_REQUIRED` only when the backend is
  active, reports the anti-cheat as not connected, and the player is required.
- The heartbeat kick applies when `kickApplies` is true. The kick reason is `heartbeat`.
- The kick timer is armed with a full deadline when a player becomes required
  (list change, whitelist removal) and no timer is armed.
  An armed timer is never postponed by the list change; each valid heartbeat
  re-arms it.
- EMAC's global whitelist flag (`whitelistGlobal`) turns off only the heartbeat kick.
- Manual kicks always work, regardless of fail-open, flags or whitelists.

Fail-open: when the backend cannot be reached or returns an invalid
`/info/server`, the plugin stops refusing connections and stops kicking until
it answers again. Manual kicks still work.

Identifiers: at admission, all of the player's identifiers (Steam included)
are checked against the whitelists and the required list. Admission requires
a Steam identifier; without one the player is refused.

## Local events

Server-side events fired with `emit`. In Lua, handle them with
`AddEventHandler`; in JavaScript, with `on`. `source` is always a number.

| Event | Arguments | When |
| --- | --- | --- |
| `octashield:playerStateChanged` | `source, state, previous` | A player's state changes. |
| `octashield:playerKicked` | `source, reason` | Fired before the disconnect. `reason`: `heartbeat`, `banned` or `admin`. |
| `octashield:whitelistChanged` | `identifier, added` | Local whitelist changed (once per real change). |
| `octashield:requiredChanged` | `identifier, added` | Required list changed (once per real change). |

Lua example:

```lua
AddEventHandler("octashield:playerKicked", function(source, reason)
  print(("player %d kicked: %s"):format(source, reason))
end)
```

## Security

- `kickApplies`, `state`, `required` and `whitelisted` reveal whether a player
  can be kicked. Expose them only through `octashield.read` or the console.
- Do not log player state automatically. The resource does not log it.
- Keep `octashield_project_secret` out of logs, public `sets`, and version control.
- Exports called without `author` are trusted by the calling resource; only
  grant them to resources you control.

## Type definitions

The folder ships three declaration files for the same public surface. They
are the contract: the server imports its data types from `octashield.d.ts`.

- `octashield.d.ts`: standalone TypeScript declarations, no `@citizenfx` dependency.
- `octashield.citizenfx.d.ts`: augments `CitizenExports`, so `exports.octashield` is typed in projects that use `@citizenfx/server`.
- `octashield.lua`: LuaLS annotations (`---@meta`).

Shared type names, the same in TypeScript and Lua:

`OctashieldExportError`, `OctashieldFailure`, `OctashieldSource`,
`OctashieldIdentifier`, `OctashieldTarget`, `OctashieldAuthor`,
`OctashieldStateName`, `OctashieldWhitelistOrigin`, `OctashieldWhitelistMode`,
`OctashieldKickReason`, `OctashieldAce`, `OctashieldPlayerState`,
`OctashieldExports`, `OctashieldEvents`.

TypeScript only: `OctashieldResult<T>`, the generic envelope.
Lua only: `Octashield<Name>Result` per export (LuaLS has no generics) and the
`Octashield*Handler` aliases.

### TypeScript

Import the types from the file:

```ts
import type { OctashieldExports, OctashieldPlayerState } from "./octashield";
```

With `@citizenfx/server`, also include `octashield.citizenfx.d.ts` in the
project (`include` or `files` in `tsconfig.json`), adjusting the path to where
you placed the folder:

```json
{
  "include": ["src/**/*", "octashield/public/octashield.citizenfx.d.ts"]
}
```

Then `exports.octashield` is typed:

```ts
const result = exports.octashield.getPlayerState(source);
if (result.ok && result.player) {
  const player: OctashieldPlayerState = result.player;
}
```

A typed event handler, using `OctashieldEvents`:

```ts
import type { OctashieldEvents } from "./octashield";

const onKicked: OctashieldEvents["octashield:playerKicked"] = (source, reason) => {
  console.log(`player ${source} dropped: ${reason}`);
};

on("octashield:playerKicked", onKicked);
```

### Lua

Add this folder to `Lua.workspace.library` in VS Code (LuaLS), then type the
exports table:

```lua
local octashield = exports.octashield --[[@as OctashieldExports]]
```

A typed handler, using `OctashieldPlayerKickedHandler`:

```lua
---@type OctashieldPlayerKickedHandler
local onKicked = function(source, reason)
  print(source, reason)
end

AddEventHandler("octashield:playerKicked", onKicked)
```

`OctashieldSource` is `number | string` in TypeScript and `integer|string`
in Lua: neither type file guarantees its format, which is validated at
runtime. A source must be a non-negative safe integer or a string of digits
only (`/^\d+$/`); anything else is rejected (`player: null`,
`player_not_found` or `permission_denied`, depending on
the export).
