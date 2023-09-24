/*
Copyright 2022 New Vector Ltd

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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room, isE2EESupported } from "livekit-client";
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc/MatrixRTCSession";
import { JoinRule, RoomMember } from "matrix-js-sdk/src/matrix";
import { Heading, Link, Text } from "@vector-im/compound-web";
import { useTranslation } from "react-i18next";

import type { IWidgetApiRequest } from "matrix-widget-api";
import { widget, ElementWidgetActions, JoinCallData } from "../widget";
import { ErrorView, FullScreenView } from "../FullScreenView";
import { LobbyView } from "./LobbyView";
import { MatrixInfo } from "./VideoPreview";
import { CallEndedView } from "./CallEndedView";
import { PosthogAnalytics } from "../analytics/PosthogAnalytics";
import { useProfile } from "../profile/useProfile";
import { findDeviceByName } from "../media-utils";
import { ActiveCall } from "./InCallView";
import { MuteStates, useMuteStates } from "./MuteStates";
import { useMediaDevices, MediaDevices } from "../livekit/MediaDevicesContext";
import { useMatrixRTCSessionMemberships } from "../useMatrixRTCSessionMemberships";
import { enterRTCSession, leaveRTCSession } from "../rtcSessionHelpers";
import { useMatrixRTCSessionJoinState } from "../useMatrixRTCSessionJoinState";
import {
  useManageRoomSharedKey,
  useIsRoomE2EE,
} from "../e2ee/sharedKeyManagement";
import { useEnableE2EE } from "../settings/useSetting";
import { useRoomAvatar } from "./useRoomAvatar";
import { useRoomName } from "./useRoomName";
import { useJoinRule } from "./useJoinRule";
import { ShareModal } from "./ShareModal";

declare global {
  interface Window {
    rtcSession?: MatrixRTCSession;
  }
}

interface Props {
  client: MatrixClient;
  isPasswordlessUser: boolean;
  confineToRoom: boolean;
  preload: boolean;
  skipLobby: boolean;
  hideHeader: boolean;
  rtcSession: MatrixRTCSession;
}

export function GroupCallView({
  client,
  isPasswordlessUser,
  confineToRoom,
  preload,
  skipLobby,
  hideHeader,
  rtcSession,
}: Props) {
  const memberships = useMatrixRTCSessionMemberships(rtcSession);
  const isJoined = useMatrixRTCSessionJoinState(rtcSession);

  const e2eeSharedKey = useManageRoomSharedKey(rtcSession.room.roomId);
  const isRoomE2EE = useIsRoomE2EE(rtcSession.room.roomId);

  useEffect(() => {
    window.rtcSession = rtcSession;
    return () => {
      delete window.rtcSession;
    };
  }, [rtcSession]);

  const { displayName, avatarUrl } = useProfile(client);
  const roomName = useRoomName(rtcSession.room);
  const roomAvatar = useRoomAvatar(rtcSession.room);
  const roomEncrypted = useIsRoomE2EE(rtcSession.room.roomId)!;

  const matrixInfo = useMemo((): MatrixInfo => {
    return {
      userId: client.getUserId()!,
      displayName: displayName!,
      avatarUrl: avatarUrl!,
      roomId: rtcSession.room.roomId,
      roomName,
      roomAlias: rtcSession.room.getCanonicalAlias(),
      roomAvatar,
      roomEncrypted,
    };
  }, [
    displayName,
    avatarUrl,
    rtcSession,
    roomName,
    roomAvatar,
    roomEncrypted,
    client,
  ]);

  const participatingMembers = useMemo(() => {
    const members: RoomMember[] = [];
    // Count each member only once, regardless of how many devices they use
    const addedUserIds = new Set<string>();
    for (const membership of memberships) {
      if (!addedUserIds.has(membership.member.userId)) {
        addedUserIds.add(membership.member.userId);
        members.push(membership.member);
      }
    }
    return members;
  }, [memberships]);

  const deviceContext = useMediaDevices();
  const latestDevices = useRef<MediaDevices>();
  latestDevices.current = deviceContext;

  const muteStates = useMuteStates(memberships.length);
  const latestMuteStates = useRef<MuteStates>();
  latestMuteStates.current = muteStates;

  useEffect(() => {
    if (skipLobby) {
      // widget && preload
      const defaultDeviceSetup = async (
        requestedDeviceData: JoinCallData
      ): Promise<void> => {
        // XXX: I think this is broken currently - LiveKit *won't* request
        // permissions and give you device names unless you specify a kind, but
        // here we want all kinds of devices. This needs a fix in livekit-client
        // for the following name-matching logic to do anything useful.
        const devices = await Room.getLocalDevices(undefined, true);
        const { audioInput, videoInput } = requestedDeviceData;
        if (audioInput === null) {
          latestMuteStates.current!.audio.setEnabled?.(false);
        } else {
          const deviceId = await findDeviceByName(
            audioInput,
            "audioinput",
            devices
          );
          if (!deviceId) {
            logger.warn("Unknown audio input: " + audioInput);
            latestMuteStates.current!.audio.setEnabled?.(false);
          } else {
            logger.debug(
              `Found audio input ID ${deviceId} for name ${audioInput}`
            );
            latestDevices.current!.audioInput.select(deviceId);
            latestMuteStates.current!.audio.setEnabled?.(true);
          }
        }

        if (videoInput === null) {
          latestMuteStates.current!.video.setEnabled?.(false);
        } else {
          const deviceId = await findDeviceByName(
            videoInput,
            "videoinput",
            devices
          );
          if (!deviceId) {
            logger.warn("Unknown video input: " + videoInput);
            latestMuteStates.current!.video.setEnabled?.(false);
          } else {
            logger.debug(
              `Found video input ID ${deviceId} for name ${videoInput}`
            );
            latestDevices.current!.videoInput.select(deviceId);
            latestMuteStates.current!.video.setEnabled?.(true);
          }
        }
      };
      // In preload mode, wait for a join action before entering
      if (widget && preload) {
        const onJoin = async (ev: CustomEvent<IWidgetApiRequest>) => {
          defaultDeviceSetup(ev.detail.data as unknown as JoinCallData);
          enterRTCSession(rtcSession);
          await Promise.all([
            widget!.api.setAlwaysOnScreen(true),
            widget!.api.transport.reply(ev.detail, {}),
          ]);
        };
        widget.lazyActions.on(ElementWidgetActions.JoinCall, onJoin);
        return () => {
          widget!.lazyActions.off(ElementWidgetActions.JoinCall, onJoin);
        };
      } else {
        defaultDeviceSetup({ audioInput: null, videoInput: null });
        enterRTCSession(rtcSession);
      }
    }
  }, [rtcSession, preload, skipLobby]);

  const [left, setLeft] = useState(false);
  const [leaveError, setLeaveError] = useState<Error | undefined>(undefined);
  const history = useHistory();

  const onLeave = useCallback(
    async (leaveError?: Error) => {
      setLeaveError(leaveError);
      setLeft(true);

      // In embedded/widget mode the iFrame will be killed right after the call ended prohibiting the posthog event from getting sent,
      // therefore we want the event to be sent instantly without getting queued/batched.
      const sendInstantly = !!widget;
      PosthogAnalytics.instance.eventCallEnded.track(
        rtcSession.room.roomId,
        rtcSession.memberships.length,
        sendInstantly
      );

      leaveRTCSession(rtcSession);
      if (widget) {
        // we need to wait until the callEnded event is tracked on posthog.
        // Otherwise the iFrame gets killed before the callEnded event got tracked.
        await new Promise((resolve) => window.setTimeout(resolve, 10)); // 10ms
        widget.api.setAlwaysOnScreen(false);
        PosthogAnalytics.instance.logout();
        widget.api.transport.send(ElementWidgetActions.HangupCall, {});
      }

      if (
        !isPasswordlessUser &&
        !confineToRoom &&
        !PosthogAnalytics.instance.isEnabled()
      ) {
        history.push("/");
      }
    },
    [rtcSession, isPasswordlessUser, confineToRoom, history]
  );

  useEffect(() => {
    if (widget && isJoined) {
      const onHangup = async (ev: CustomEvent<IWidgetApiRequest>) => {
        leaveRTCSession(rtcSession);
        await widget!.api.transport.reply(ev.detail, {});
        widget!.api.setAlwaysOnScreen(false);
      };
      widget.lazyActions.once(ElementWidgetActions.HangupCall, onHangup);
      return () => {
        widget!.lazyActions.off(ElementWidgetActions.HangupCall, onHangup);
      };
    }
  }, [isJoined, rtcSession]);

  const [e2eeEnabled] = useEnableE2EE();

  const e2eeConfig = useMemo(
    () => (e2eeSharedKey ? { sharedKey: e2eeSharedKey } : undefined),
    [e2eeSharedKey]
  );

  const onReconnect = useCallback(() => {
    setLeft(false);
    setLeaveError(undefined);
    enterRTCSession(rtcSession);
  }, [rtcSession]);

  const joinRule = useJoinRule(rtcSession.room);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const onDismissShareModal = useCallback(
    () => setShareModalOpen(false),
    [setShareModalOpen]
  );

  const onShareClickFn = useCallback(
    () => setShareModalOpen(true),
    [setShareModalOpen]
  );
  const onShareClick = joinRule === JoinRule.Public ? onShareClickFn : null;

  const onHomeClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      history.push("/");
    },
    [history]
  );

  const { t } = useTranslation();

  if (e2eeEnabled && isRoomE2EE && !e2eeSharedKey) {
    return (
      <ErrorView
        error={
          new Error(
            "No E2EE key provided: please make sure the URL you're using to join this call has been retrieved using the in-app button."
          )
        }
      />
    );
  } else if (!isE2EESupported() && isRoomE2EE) {
    return (
      <FullScreenView>
        <Heading>Incompatible Browser</Heading>
        <Text>
          {t(
            "Your web browser does not support media end-to-end encryption. Supported Browsers are Chrome, Safari, Firefox >=117"
          )}
        </Text>
        <Link href="/" onClick={onHomeClick}>
          {t("Home")}
        </Link>
      </FullScreenView>
    );
  } else if (!e2eeEnabled && isRoomE2EE) {
    return <ErrorView error={new Error("You need to enable E2EE to join.")} />;
  }

  const shareModal = (
    <ShareModal
      room={rtcSession.room}
      open={shareModalOpen}
      onDismiss={onDismissShareModal}
    />
  );

  if (isJoined) {
    return (
      <>
        {shareModal}
        <ActiveCall
          client={client}
          matrixInfo={matrixInfo}
          rtcSession={rtcSession}
          participatingMembers={participatingMembers}
          onLeave={onLeave}
          hideHeader={hideHeader}
          muteStates={muteStates}
          e2eeConfig={e2eeConfig}
          //otelGroupCallMembership={otelGroupCallMembership}
          onShareClick={onShareClick}
        />
      </>
    );
  } else if (left) {
    // The call ended view is shown for two reasons: prompting guests to create
    // an account, and prompting users that have opted into analytics to provide
    // feedback. We don't show a feedback prompt to widget users however (at
    // least for now), because we don't yet have designs that would allow widget
    // users to dismiss the feedback prompt and close the call window without
    // submitting anything.
    if (
      isPasswordlessUser ||
      (PosthogAnalytics.instance.isEnabled() && widget === null) ||
      leaveError
    ) {
      return (
        <CallEndedView
          endedCallId={rtcSession.room.roomId}
          client={client}
          isPasswordlessUser={isPasswordlessUser}
          confineToRoom={confineToRoom}
          leaveError={leaveError}
          reconnect={onReconnect}
        />
      );
    } else {
      // If the user is a regular user, we'll have sent them back to the homepage,
      // so just sit here & do nothing: otherwise we would (briefly) mount the
      // LobbyView again which would open capture devices again.
      return null;
    }
  } else if (preload) {
    return null;
  } else {
    return (
      <>
        {shareModal}
        <LobbyView
          client={client}
          matrixInfo={matrixInfo}
          muteStates={muteStates}
          onEnter={() => enterRTCSession(rtcSession)}
          confineToRoom={confineToRoom}
          hideHeader={hideHeader}
          participatingMembers={participatingMembers}
          onShareClick={onShareClick}
        />
      </>
    );
  }
}
