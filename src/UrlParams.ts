/*
Copyright 2022 - 2023 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */

import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { logger } from "matrix-js-sdk/src/logger";

import { Config } from "./config/Config";

export const PASSWORD_PARAM = "password";

interface RoomIdentifier {
  roomAlias: string | null;
  roomId: string | null;
  viaServers: string[];
}

interface UrlParams {
  /**
   * Anything about what room we're pointed to should be from useRoomIdentifier which
   * parses the path and resolves alias with respect to the default server name, however
   * roomId is an exception as we need the room ID in embedded (matroyska) mode, and not
   * the room alias (or even the via params because we are not trying to join it). This
   * is also not validated, where it is in useRoomIdentifier().
   */
  roomId: string | null;
  /**
   * Whether the app is running in embedded mode, and should keep the user
   * confined to the current room.
   */
  isEmbedded: boolean;
  /**
   * Whether the app should pause before joining the call until it sees an
   * io.element.join widget action, allowing it to be preloaded.
   */
  preload: boolean;
  /**
   * Whether to hide the room header when in a call.
   */
  hideHeader: boolean;
  /**
   * Whether to hide the screen-sharing button.
   */
  hideScreensharing: boolean;
  /**
   * Whether to use end-to-end encryption.
   */
  e2eEnabled: boolean;
  /**
   * The user's ID (only used in matryoshka mode).
   */
  userId: string | null;
  /**
   * The display name to use for auto-registration.
   */
  displayName: string | null;
  /**
   * The device's ID (only used in matryoshka mode).
   */
  deviceId: string | null;
  /**
   * The base URL of the homeserver to use for media lookups in matryoshka mode.
   */
  baseUrl: string | null;
  /**
   * The BCP 47 code of the language the app should use.
   */
  lang: string | null;
  /**
   * The fonts which the interface should use, if not empty.
   */
  fonts: string[];
  /**
   * The factor by which to scale the interface's font size.
   */
  fontScale: number | null;
  /**
   * The Posthog analytics ID. It is only available if the user has given consent for sharing telemetry in element web.
   */
  analyticsID: string | null;
  /**
   * Whether the app is allowed to use fallback STUN servers for ICE in case the
   * user's homeserver doesn't provide any.
   */
  allowIceFallback: boolean;
  /**
   * E2EE password
   */
  password: string | null;
}

export function editFragmentQuery(
  hash: string,
  edit: (params: URLSearchParams) => URLSearchParams
): string {
  const fragmentQueryStart = hash.indexOf("?");
  const fragmentParams = edit(
    new URLSearchParams(
      fragmentQueryStart === -1 ? "" : hash.substring(fragmentQueryStart)
    )
  );
  return `${hash.substring(
    0,
    fragmentQueryStart
  )}?${fragmentParams.toString()}`;
}

class ParamParser {
  private fragmentParams: URLSearchParams;
  private queryParams: URLSearchParams;

  constructor(search: string, hash: string) {
    this.queryParams = new URLSearchParams(search);

    const fragmentQueryStart = hash.indexOf("?");
    this.fragmentParams = new URLSearchParams(
      fragmentQueryStart === -1 ? "" : hash.substring(fragmentQueryStart)
    );
  }

  // Normally, URL params should be encoded in the fragment so as to avoid
  // leaking them to the server. However, we also check the normal query
  // string for backwards compatibility with versions that only used that.
  hasParam(name: string): boolean {
    if (!this.fragmentParams.has(name) && this.queryParams.has(name)) {
      logger.warn(
        `Parameter ${name} loaded from query param (not hash). This is unsupported and will soon be removed.`
      );
    }
    return this.fragmentParams.has(name) || this.queryParams.has(name);
  }

  getParam(name: string): string | null {
    if (!this.fragmentParams.has(name) && this.queryParams.has(name)) {
      logger.warn(
        `Parameter ${name} loaded from query param (not hash). This is unsupported and will soon be removed.`
      );
    }
    return this.fragmentParams.get(name) ?? this.queryParams.get(name);
  }

  getAllParams(name: string): string[] {
    return [
      ...this.fragmentParams.getAll(name),
      ...this.queryParams.getAll(name),
    ];
  }
}

/**
 * Gets the app parameters for the current URL.
 * @param search The URL search string
 * @param hash The URL hash
 * @returns The app parameters encoded in the URL
 */
export const getUrlParams = (
  search = window.location.search,
  hash = window.location.hash
): UrlParams => {
  const parser = new ParamParser(search, hash);

  const fontScale = parseFloat(parser.getParam("fontScale") ?? "");

  return {
    // NB. we don't validate roomId here as we do in getRoomIdentifierFromUrl:
    // what would we do if it were invalid? If the widget API says that's what
    // the room ID is, then that's what it is.
    roomId: parser.getParam("roomId"),
    password: parser.getParam(PASSWORD_PARAM),
    isEmbedded: parser.hasParam("embed"),
    preload: parser.hasParam("preload"),
    hideHeader: parser.hasParam("hideHeader"),
    hideScreensharing: parser.hasParam("hideScreensharing"),
    e2eEnabled: parser.getParam("enableE2e") !== "false", // Defaults to true
    userId: parser.getParam("userId"),
    displayName: parser.getParam("displayName"),
    deviceId: parser.getParam("deviceId"),
    baseUrl: parser.getParam("baseUrl"),
    lang: parser.getParam("lang"),
    fonts: parser.getAllParams("font"),
    fontScale: Number.isNaN(fontScale) ? null : fontScale,
    analyticsID: parser.getParam("analyticsID"),
    allowIceFallback: parser.hasParam("allowIceFallback"),
  };
};

/**
 * Hook to simplify use of getUrlParams.
 * @returns The app parameters for the current URL
 */
export const useUrlParams = (): UrlParams => {
  const { search, hash } = useLocation();
  return useMemo(() => getUrlParams(search, hash), [search, hash]);
};

export function getRoomIdentifierFromUrl(
  pathname: string,
  search: string,
  hash: string
): RoomIdentifier {
  let baseRoomString: string | undefined;
  if (hash === "" || hash.startsWith("#?")) {
    // if the hash is absent or being used as a query string, the alias is the last
    // path component.
    baseRoomString = pathname.split("/").pop();
  } else {
    baseRoomString = hash;
    logger.warn(
      "Using whole hash as room name: this is deprecated and will be removed soon."
    );
  }

  let roomAlias: string | null = null;
  if (baseRoomString !== undefined) {
    // ensure exactly one hash on the start
    roomAlias = `${baseRoomString.replace(/^#*/, "#")}`;
    if (!roomAlias.includes(":")) {
      roomAlias += ":" + Config.defaultServerName();
    }
  }

  const parser = new ParamParser(search, hash);

  // Make sure roomId is valid
  let roomId: string | null = parser.getParam("roomId");
  if (!roomId?.startsWith("!")) {
    roomId = null;
  } else if (!roomId.includes("")) {
    roomId = null;
  }

  if (roomId) {
    logger.warn(
      "Room loaded by room ID: this is not supported and will be removed soon."
    );
  }

  return {
    roomAlias,
    roomId,
    viaServers: parser.getAllParams("viaServers"),
  };
}

export const useRoomIdentifier = (): RoomIdentifier => {
  const { pathname, search, hash } = useLocation();
  return useMemo(
    () => getRoomIdentifierFromUrl(pathname, search, hash),
    [pathname, search, hash]
  );
};
