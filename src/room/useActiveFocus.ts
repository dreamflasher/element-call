/*
Copyright 2023 New Vector Ltd

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

import {
  MatrixRTCSession,
  MatrixRTCSessionEvent,
} from "matrix-js-sdk/src/matrixrtc/MatrixRTCSession";
import { useCallback, useEffect, useState } from "react";
import { deepCompare } from "matrix-js-sdk/src/utils";
import { logger } from "matrix-js-sdk/src/logger";

import { LivekitFocus } from "../livekit/LivekitFocus";

function getActiveFocus(
  rtcSession: MatrixRTCSession,
): LivekitFocus | undefined {
  const oldestMembership = rtcSession.getOldestMembership();
  const focus = oldestMembership?.getActiveFoci()[0] as LivekitFocus;

  if (focus) {
    logger.info(
      `Got active focus for call from ${oldestMembership?.sender}/${oldestMembership?.deviceId}`,
      focus,
    );
  }

  return focus;
}

/**
 * Gets the currently active (livekit) focus for a MatrixRTC session
 * This logic is specific to livekit foci where the whole call must use one
 * and the same focus.
 */
export function useActiveFocus(
  rtcSession: MatrixRTCSession,
): LivekitFocus | undefined {
  const [activeFocus, setActiveFocus] = useState(() =>
    getActiveFocus(rtcSession),
  );

  const onMembershipsChanged = useCallback(() => {
    const newActiveFocus = getActiveFocus(rtcSession);

    if (!deepCompare(activeFocus, newActiveFocus)) {
      setActiveFocus(newActiveFocus);
    }
  }, [activeFocus, rtcSession]);

  useEffect(() => {
    rtcSession.on(
      MatrixRTCSessionEvent.MembershipsChanged,
      onMembershipsChanged,
    );

    return () => {
      rtcSession.off(
        MatrixRTCSessionEvent.MembershipsChanged,
        onMembershipsChanged,
      );
    };
  });

  return activeFocus;
}
