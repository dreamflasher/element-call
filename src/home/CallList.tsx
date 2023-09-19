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

import { Link } from "react-router-dom";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk";

import { CopyButton } from "../button";
import { Avatar, Size } from "../Avatar";
import styles from "./CallList.module.css";
import {
  getAbsoluteRoomUrlForRoom,
  getRelativeRoomUrlForRoom,
} from "../matrix-utils";
import { Body } from "../typography/Typography";
import { GroupCallRoom } from "./useGroupCallRooms";
import { useRoomSharedKey } from "../e2ee/sharedKeyManagement";

interface CallListProps {
  rooms: GroupCallRoom[];
  client: MatrixClient;
}
export function CallList({ rooms, client }: CallListProps) {
  return (
    <>
      <div className={styles.callList}>
        {rooms.map(({ room, roomName, avatarUrl }) => (
          <CallTile
            key={room.roomId}
            client={client}
            name={roomName}
            avatarUrl={avatarUrl}
            room={room}
            //participants={participants}
          />
        ))}
        {rooms.length > 3 && (
          <>
            <div className={styles.callTileSpacer} />
            <div className={styles.callTileSpacer} />
          </>
        )}
      </div>
    </>
  );
}
interface CallTileProps {
  name: string;
  avatarUrl: string;
  room: Room;
  //participants: RoomMember[];
  client: MatrixClient;
}
function CallTile({ name, avatarUrl, room }: CallTileProps) {
  const roomSharedKey = useRoomSharedKey(room.roomId) ?? undefined;

  return (
    <div className={styles.callTile}>
      <Link
        to={getRelativeRoomUrlForRoom(room, roomSharedKey)}
        className={styles.callTileLink}
      >
        <Avatar id={room.roomId} name={name} size={Size.LG} src={avatarUrl} />
        <div className={styles.callInfo}>
          <Body overflowEllipsis fontWeight="semiBold">
            {name}
          </Body>
        </div>
        <div className={styles.copyButtonSpacer} />
      </Link>
      <CopyButton
        className={styles.copyButton}
        variant="icon"
        value={getAbsoluteRoomUrlForRoom(room, roomSharedKey)}
      />
    </div>
  );
}
