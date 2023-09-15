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

import { useRef, useEffect, FC } from "react";
import { Trans, useTranslation } from "react-i18next";
import { MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";

import styles from "./LobbyView.module.css";
import { Button, CopyButton } from "../button";
import { Header, LeftNav, RightNav, RoomHeaderInfo } from "../Header";
import { getRoomUrl } from "../matrix-utils";
import { Body, Link } from "../typography/Typography";
import { useLocationNavigation } from "../useLocationNavigation";
import { MatrixInfo, VideoPreview } from "./VideoPreview";
import { MuteStates } from "./MuteStates";
import { useRoomSharedKey } from "../e2ee/sharedKeyManagement";
import { ShareButton } from "../button/ShareButton";

interface Props {
  client: MatrixClient;
  matrixInfo: MatrixInfo;
  muteStates: MuteStates;
  onEnter: () => void;
  isEmbedded: boolean;
  hideHeader: boolean;
  participatingMembers: RoomMember[];
  onShareClick: (() => void) | null;
}

export const LobbyView: FC<Props> = ({
  client,
  matrixInfo,
  muteStates,
  onEnter,
  isEmbedded,
  hideHeader,
  participatingMembers,
  onShareClick,
}) => {
  const { t } = useTranslation();
  const roomSharedKey = useRoomSharedKey(matrixInfo.roomId);
  useLocationNavigation();

  const joinCallButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (joinCallButtonRef.current) {
      joinCallButtonRef.current.focus();
    }
  }, [joinCallButtonRef]);

  return (
    <div className={styles.room}>
      {!hideHeader && (
        <Header>
          <LeftNav>
            <RoomHeaderInfo
              id={matrixInfo.roomId}
              name={matrixInfo.roomName}
              avatarUrl={matrixInfo.roomAvatar}
              encrypted={matrixInfo.roomEncrypted}
              participants={participatingMembers}
              client={client}
            />
          </LeftNav>
          <RightNav>
            {onShareClick !== null && <ShareButton onClick={onShareClick} />}
          </RightNav>
        </Header>
      )}
      <div className={styles.joinRoom}>
        <div className={styles.joinRoomContent}>
          <VideoPreview matrixInfo={matrixInfo} muteStates={muteStates} />
          <Trans>
            <Button
              ref={joinCallButtonRef}
              className={styles.copyButton}
              size="lg"
              onPress={() => onEnter()}
              data-testid="lobby_joinCall"
            >
              Join call now
            </Button>
            <Body>Or</Body>
            <CopyButton
              variant="secondaryCopy"
              value={getRoomUrl(matrixInfo.roomId, roomSharedKey ?? undefined)}
              className={styles.copyButton}
              copiedMessage={t("Call link copied")}
              data-testid="lobby_inviteLink"
            >
              Copy call link and join later
            </CopyButton>
          </Trans>
        </div>
        {!isEmbedded && (
          <Body className={styles.joinRoomFooter}>
            <Link color="primary" to="/">
              {t("Take me Home")}
            </Link>
          </Body>
        )}
      </div>
    </div>
  );
};
