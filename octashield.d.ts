// Public types of the octashield server interface: the exports other server
// resources call through `exports.octashield` and the local server events
// they listen to with `on`. Standalone: no dependency on @citizenfx or on the
// plugin sources, which import their public data types from here.
//
// With @citizenfx/server, also reference `octashield.citizenfx.d.ts` to type
// `exports.octashield` / `exports["octashield"]`.

/** Error code of a failed export call. Exports never throw. */
export type OctashieldExportError =
  | "permission_denied"
  | "player_not_found"
  | "invalid_identifier"
  // An unexpected error; it is not logged, since arguments may carry anything.
  | "internal_error";

export type OctashieldFailure = { ok: false; error: OctashieldExportError };

/** Envelope of every export: `{ ok: true, ...data }` or `{ ok: false, error }`. */
export type OctashieldResult<T extends object> = ({ ok: true } & T) | OctashieldFailure;

/** One ACE per action, reading included. The server console (source 0) always may. */
export type OctashieldAce =
  | "octashield.read"
  | "octashield.kick"
  | "octashield.whitelist";

/**
 * A player source: a number, or a string of digits (e.g. `"3"`). A target
 * source must be a connected player.
 *
 * Neither this file nor `octashield.lua` guarantees the format; it is
 * validated at runtime. Accepted: a non-negative safe integer, or a string
 * made only of digits (`/^\d+$/`; surrounding whitespace is trimmed for
 * targets, not for `author`). Values such as `-1`, `1.5`, `"-1"`, `"1.5"`,
 * `"1e3"`, `"0x10"` or unsafe integers are rejected:
 * - `getPlayerState` returns `{ player: null }`;
 * - `kickPlayer` fails with `player_not_found`;
 * - exports taking an {@link OctashieldTarget} fail with `player_not_found`
 *   for a number and read a non-digit string as an identifier
 *   (`invalid_identifier` unless it is `prefix:value`);
 * - as `author`, it is `permission_denied`.
 */
export type OctashieldSource = number | string;

/**
 * Who performs the action. Omitted (`undefined`/`null`), the calling resource
 * is responsible for permissions. Given, it must be the console (`0`) or a
 * player source allowed the export's ACE; anything else, including a
 * negative, fractional or non-numeric value, is `permission_denied`.
 */
export type OctashieldAuthor = OctashieldSource | null | undefined;

/**
 * A textual identifier, `prefix:value` (e.g. `steam:110000112345678`), online
 * or not. Compared lowercase.
 */
export type OctashieldIdentifier = `${string}:${string}`;

/**
 * A connected player by source (resolved over every identifier the player had
 * at admission) or a textual identifier (checked alone).
 */
export type OctashieldTarget = OctashieldSource | OctashieldIdentifier;

/**
 * - `connecting`: admitted, no `CLIENT_READY` yet.
 * - `waiting`: session started, no valid heartbeat yet.
 * - `active`: a valid heartbeat within the deadline.
 * - `expired`: past the deadline while the heartbeat kick does not apply.
 */
export type OctashieldStateName = "connecting" | "waiting" | "active" | "expired";

/** `global` is EMAC's whitelist; `local` this server's (global wins). */
export type OctashieldWhitelistOrigin = "none" | "global" | "local";

/**
 * Convar `octashield_whitelist_mode`. `selected`: everyone not whitelisted
 * must run the anti-cheat. `global`: only those on the required list must.
 */
export type OctashieldWhitelistMode = "selected" | "global";

/**
 * Why the plugin dropped a player: `heartbeat` (no valid heartbeat in time),
 * `banned` (banned after joining) or `admin` (manual kick).
 */
export type OctashieldKickReason = "heartbeat" | "banned" | "admin";

export type OctashieldPlayerState = {
  source: number;
  state: OctashieldStateName;
  /** The identifier chosen at admission. */
  identifier: string;
  whitelisted: OctashieldWhitelistOrigin;
  /** Whether the player must run the anti-cheat in the current whitelist mode. */
  required: boolean;
  /** Whether the heartbeat kick can hit the player right now. */
  kickApplies: boolean;
  /** Epoch ms: the heartbeat deadline. */
  validUntil: number;
  /** Epoch ms of the last valid heartbeat; null before the first. */
  lastHeartbeatAt: number | null;
};

/** Exports of the `octashield` resource. */
export interface OctashieldExports {
  /**
   * State of a connected player; `player` is null for an unknown source
   * (not connected, or not a source at all).
   * ACE: `octashield.read`. Errors: `permission_denied`, `internal_error`.
   */
  getPlayerState(
    source: OctashieldSource,
    author?: OctashieldAuthor
  ): OctashieldResult<{ player: OctashieldPlayerState | null }>;

  /**
   * State of every connected player, sorted by source.
   * ACE: `octashield.read`. Errors: `permission_denied`, `internal_error`.
   */
  getPlayers(author?: OctashieldAuthor): OctashieldResult<{ players: OctashieldPlayerState[] }>;

  /**
   * Drops a connected player with `KICKED_BY_ADMIN`, whatever the kick
   * settings or whitelist; emits `octashield:playerKicked` with `admin`.
   * ACE: `octashield.kick`. Errors: `permission_denied`, `player_not_found`,
   * `internal_error`.
   */
  kickPlayer(source: OctashieldSource, author?: OctashieldAuthor): OctashieldResult<{}>;

  /**
   * Adds an identifier (or a connected player's chosen identifier) to the
   * local whitelist; its prefix must be in `octashield_acceptable_identifiers`.
   * Already present is still `ok`.
   * ACE: `octashield.whitelist`. Errors: `permission_denied`,
   * `player_not_found`, `invalid_identifier`, `internal_error`.
   */
  addWhitelist(target: OctashieldTarget, author?: OctashieldAuthor): OctashieldResult<{}>;

  /**
   * Removes an identifier (or a connected player's chosen identifier) from
   * the local whitelist. Already absent is still `ok`.
   * ACE: `octashield.whitelist`. Errors: `permission_denied`,
   * `player_not_found`, `invalid_identifier`, `internal_error`.
   */
  removeWhitelist(target: OctashieldTarget, author?: OctashieldAuthor): OctashieldResult<{}>;

  /**
   * Identifiers on the local whitelist, lowercase.
   * ACE: `octashield.read`. Errors: `permission_denied`, `internal_error`.
   */
  listWhitelist(author?: OctashieldAuthor): OctashieldResult<{ identifiers: string[] }>;

  /**
   * Which whitelist, if any, covers the target (EMAC's or the local one).
   * ACE: `octashield.read`. Errors: `permission_denied`, `player_not_found`,
   * `invalid_identifier`, `internal_error`.
   */
  isWhitelisted(
    target: OctashieldTarget,
    author?: OctashieldAuthor
  ): OctashieldResult<{ whitelisted: OctashieldWhitelistOrigin }>;

  /**
   * Adds an identifier (or a connected player's chosen identifier) to the
   * required list, effective in `global` whitelist mode; its prefix must be in
   * `octashield_acceptable_identifiers`. Already present is still `ok`.
   * ACE: `octashield.whitelist`. Errors: `permission_denied`,
   * `player_not_found`, `invalid_identifier`, `internal_error`.
   */
  addRequired(target: OctashieldTarget, author?: OctashieldAuthor): OctashieldResult<{}>;

  /**
   * Removes an identifier (or a connected player's chosen identifier) from
   * the required list. Already absent is still `ok`.
   * ACE: `octashield.whitelist`. Errors: `permission_denied`,
   * `player_not_found`, `invalid_identifier`, `internal_error`.
   */
  removeRequired(target: OctashieldTarget, author?: OctashieldAuthor): OctashieldResult<{}>;

  /**
   * Identifiers on the required list, lowercase.
   * ACE: `octashield.read`. Errors: `permission_denied`, `internal_error`.
   */
  listRequired(author?: OctashieldAuthor): OctashieldResult<{ identifiers: string[] }>;

  /**
   * Whether the target must run the anti-cheat in the current whitelist mode
   * (whitelists included).
   * ACE: `octashield.read`. Errors: `permission_denied`, `player_not_found`,
   * `invalid_identifier`, `internal_error`.
   */
  isRequired(target: OctashieldTarget, author?: OctashieldAuthor): OctashieldResult<{ required: boolean }>;
}

/** Local server events (`on`), never sent to clients; `source` is always a number. */
export interface OctashieldEvents {
  /** A player's state changed (also checked every second). */
  "octashield:playerStateChanged": (
    source: number,
    state: OctashieldStateName,
    previous: OctashieldStateName
  ) => void;
  /** Emitted right before the plugin drops the player. */
  "octashield:playerKicked": (source: number, reason: OctashieldKickReason) => void;
  /** The local whitelist changed; `identifier` is lowercase. */
  "octashield:whitelistChanged": (identifier: string, added: boolean) => void;
  /** The required list changed; `identifier` is lowercase. */
  "octashield:requiredChanged": (identifier: string, added: boolean) => void;
}
