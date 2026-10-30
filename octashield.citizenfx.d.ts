// Types `exports.octashield` and `exports["octashield"]` for projects using
// @citizenfx/server, whose global CitizenExports interface this augments.
// Add this file to the project (tsconfig `include` or `files`) next to
// octashield.d.ts.
import type { OctashieldExports } from "./octashield";

declare global {
  interface CitizenExports {
    // The intersection keeps CitizenExports' index signature satisfied.
    octashield: OctashieldExports & { [exportKey: string | number]: Function };
  }
}

export {};
