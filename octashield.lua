---@meta

-- OCTA Shield server-side public interface (resource `octashield`).
-- Type definitions only. Mirrors octashield.d.ts: same names, same shapes.
-- Add this folder to Lua.workspace.library in VS Code (LuaLS) so the types load.
-- See README.md in this folder for semantics.

---Error code of a failed export call. Exports never throw.
---@alias OctashieldExportError
---| "permission_denied"
---| "player_not_found"
---| "invalid_identifier"
---| "internal_error"

---Envelope of a failed export: `{ ok = false, error }`.
---@class OctashieldFailure
---@field ok false
---@field error OctashieldExportError

---A player source: an integer, or a string of digits (e.g. "3").
---Neither this file nor octashield.d.ts guarantees the format; it is
---validated at runtime: a non-negative safe integer, or a digit-only string.
---A target source must be a connected player.
---@alias OctashieldSource integer|string

---A textual identifier, `prefix:value` (e.g. "steam:110000112345678"),
---online or not. Compared lowercase.
---@alias OctashieldIdentifier string

---A connected player by source (resolved over every identifier the player
---had at admission) or a textual identifier (checked alone).
---@alias OctashieldTarget OctashieldSource|OctashieldIdentifier

---Who performs the action. Omitted (nil), the calling resource is responsible
---for permissions. Given, it must be the console (0) or a player source
---allowed the export's ACE; anything else is `permission_denied`.
---@alias OctashieldAuthor OctashieldSource|nil

---`connecting`: admitted, no CLIENT_READY yet.
---`waiting`: session started, no valid heartbeat yet.
---`active`: a valid heartbeat within the deadline.
---`expired`: past the deadline while the heartbeat kick does not apply.
---@alias OctashieldStateName
---| "connecting"
---| "waiting"
---| "active"
---| "expired"

---`global` is EMAC's whitelist; `local` this server's (global wins).
---@alias OctashieldWhitelistOrigin
---| "none"
---| "global"
---| "local"

---Convar `octashield_whitelist_mode`. `selected`: everyone not whitelisted
---must run the anti-cheat. `global`: only those on the required list must.
---@alias OctashieldWhitelistMode
---| "selected"
---| "global"

---Why the plugin dropped a player: `heartbeat` (no valid heartbeat in time),
---`banned` (banned after joining) or `admin` (manual kick).
---@alias OctashieldKickReason
---| "heartbeat"
---| "banned"
---| "admin"

---One ACE per action, reading included. The server console (source 0) always may.
---@alias OctashieldAce
---| "octashield.read"
---| "octashield.kick"
---| "octashield.whitelist"

---@class OctashieldPlayerState
---@field source integer
---@field state OctashieldStateName
---The identifier chosen at admission.
---@field identifier string
---@field whitelisted OctashieldWhitelistOrigin
---Whether the player must run the anti-cheat in the current whitelist mode.
---@field required boolean
---Whether the heartbeat kick can hit the player right now.
---@field kickApplies boolean
---Epoch ms: the heartbeat deadline.
---@field validUntil integer
---Epoch ms of the last valid heartbeat; nil before the first.
---@field lastHeartbeatAt integer?

---@class OctashieldPlayerStateResult
---@field ok boolean
---@field error? OctashieldExportError
---Nil for an unknown source (not connected, or not a source at all).
---@field player? OctashieldPlayerState

---@class OctashieldPlayersResult
---@field ok boolean
---@field error? OctashieldExportError
---Sorted by source.
---@field players? OctashieldPlayerState[]

---@class OctashieldKickPlayerResult
---@field ok boolean
---@field error? OctashieldExportError

---@class OctashieldAddWhitelistResult
---@field ok boolean
---@field error? OctashieldExportError

---@class OctashieldRemoveWhitelistResult
---@field ok boolean
---@field error? OctashieldExportError

---@class OctashieldListWhitelistResult
---@field ok boolean
---@field error? OctashieldExportError
---Lowercase.
---@field identifiers? string[]

---@class OctashieldIsWhitelistedResult
---@field ok boolean
---@field error? OctashieldExportError
---@field whitelisted? OctashieldWhitelistOrigin

---@class OctashieldAddRequiredResult
---@field ok boolean
---@field error? OctashieldExportError

---@class OctashieldRemoveRequiredResult
---@field ok boolean
---@field error? OctashieldExportError

---@class OctashieldListRequiredResult
---@field ok boolean
---@field error? OctashieldExportError
---Lowercase.
---@field identifiers? string[]

---@class OctashieldIsRequiredResult
---@field ok boolean
---@field error? OctashieldExportError
---@field required? boolean

---Exports of the `octashield` resource. Call with `:` in Lua.
---@class OctashieldExports
---State of a connected player. ACE: octashield.read.
---Errors: permission_denied, internal_error.
---@field getPlayerState fun(self: OctashieldExports, source: OctashieldSource, author?: OctashieldAuthor): OctashieldPlayerStateResult
---State of every connected player, sorted by source. ACE: octashield.read.
---Errors: permission_denied, internal_error.
---@field getPlayers fun(self: OctashieldExports, author?: OctashieldAuthor): OctashieldPlayersResult
---Drops a connected player with KICKED_BY_ADMIN, whatever the kick settings,
---or the whitelist; emits octashield:playerKicked with admin.
---ACE: octashield.kick. Errors: permission_denied, player_not_found, internal_error.
---@field kickPlayer fun(self: OctashieldExports, source: OctashieldSource, author?: OctashieldAuthor): OctashieldKickPlayerResult
---Adds an identifier (or a connected player's chosen identifier) to the local
---whitelist; its prefix must be in octashield_acceptable_identifiers.
---Already present is still ok. ACE: octashield.whitelist.
---Errors: permission_denied, player_not_found, invalid_identifier, internal_error.
---@field addWhitelist fun(self: OctashieldExports, target: OctashieldTarget, author?: OctashieldAuthor): OctashieldAddWhitelistResult
---Removes an identifier (or a connected player's chosen identifier) from the
---local whitelist. Already absent is still ok. ACE: octashield.whitelist.
---Errors: permission_denied, player_not_found, invalid_identifier, internal_error.
---@field removeWhitelist fun(self: OctashieldExports, target: OctashieldTarget, author?: OctashieldAuthor): OctashieldRemoveWhitelistResult
---Identifiers on the local whitelist, lowercase. ACE: octashield.read.
---Errors: permission_denied, internal_error.
---@field listWhitelist fun(self: OctashieldExports, author?: OctashieldAuthor): OctashieldListWhitelistResult
---Which whitelist, if any, covers the target (EMAC's or the local one).
---ACE: octashield.read. Errors: permission_denied, player_not_found,
---invalid_identifier, internal_error.
---@field isWhitelisted fun(self: OctashieldExports, target: OctashieldTarget, author?: OctashieldAuthor): OctashieldIsWhitelistedResult
---Adds an identifier (or a connected player's chosen identifier) to the
---required list, effective in global whitelist mode; its prefix must be in
---octashield_acceptable_identifiers. Already present is still ok.
---ACE: octashield.whitelist. Errors: permission_denied, player_not_found,
---invalid_identifier, internal_error.
---@field addRequired fun(self: OctashieldExports, target: OctashieldTarget, author?: OctashieldAuthor): OctashieldAddRequiredResult
---Removes an identifier (or a connected player's chosen identifier) from the
---required list. Already absent is still ok. ACE: octashield.whitelist.
---Errors: permission_denied, player_not_found, invalid_identifier, internal_error.
---@field removeRequired fun(self: OctashieldExports, target: OctashieldTarget, author?: OctashieldAuthor): OctashieldRemoveRequiredResult
---Identifiers on the required list, lowercase. ACE: octashield.read.
---Errors: permission_denied, internal_error.
---@field listRequired fun(self: OctashieldExports, author?: OctashieldAuthor): OctashieldListRequiredResult
---Whether the target must run the anti-cheat in the current whitelist mode
---(whitelists included). ACE: octashield.read.
---Errors: permission_denied, player_not_found, invalid_identifier, internal_error.
---@field isRequired fun(self: OctashieldExports, target: OctashieldTarget, author?: OctashieldAuthor): OctashieldIsRequiredResult

---Handler of octashield:playerStateChanged. source is always an integer.
---@alias OctashieldPlayerStateChangedHandler fun(source: integer, state: OctashieldStateName, previous: OctashieldStateName)
---Handler of octashield:playerKicked, emitted right before the drop.
---@alias OctashieldPlayerKickedHandler fun(source: integer, reason: OctashieldKickReason)
---Handler of octashield:whitelistChanged. identifier is lowercase.
---@alias OctashieldWhitelistChangedHandler fun(identifier: string, added: boolean)
---Handler of octashield:requiredChanged. identifier is lowercase.
---@alias OctashieldRequiredChangedHandler fun(identifier: string, added: boolean)

---Local server events (AddEventHandler), never sent to clients; source is always an integer.
---@class OctashieldEvents
---@field ["octashield:playerStateChanged"] OctashieldPlayerStateChangedHandler
---@field ["octashield:playerKicked"] OctashieldPlayerKickedHandler
---@field ["octashield:whitelistChanged"] OctashieldWhitelistChangedHandler
---@field ["octashield:requiredChanged"] OctashieldRequiredChangedHandler
