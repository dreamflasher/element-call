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

import { FC, MouseEvent, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Text } from "@vector-im/compound-web";
import { ReactComponent as PopOutIcon } from "@vector-im/compound-design-tokens/icons/pop-out.svg";

import { Modal } from "../Modal";
import { useRoomSharedKey } from "../e2ee/sharedKeyManagement";
import { getRoomUrl } from "../matrix-utils";
import styles from "./AppSelectionModal.module.css";
import { editFragmentQuery } from "../UrlParams";

interface Props {
  roomId: string | null;
}

export const AppSelectionModal: FC<Props> = ({ roomId }) => {
  const { t } = useTranslation();

  const [open, setOpen] = useState(true);
  const onBrowserClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    },
    [setOpen]
  );

  const roomSharedKey = useRoomSharedKey(roomId ?? "");
  const appUrl = useMemo(() => {
    // If the room ID is not known, fall back to the URL of the current page
    const url = new URL(
      roomId === null
        ? window.location.href
        : getRoomUrl(roomId, roomSharedKey ?? undefined)
    );
    // Edit the URL to prevent the app selection prompt from appearing a second
    // time within the app, and to keep the user confined to the current room
    url.hash = editFragmentQuery(url.hash, (params) => {
      params.set("appPrompt", "false");
      params.set("confineToRoom", "true");
      return params;
    });

    const result = new URL("element://call");
    result.searchParams.set("url", url.toString());
    return result.toString();
  }, [roomId, roomSharedKey]);

  return (
    <Modal className={styles.modal} title={t("Select app")} open={open}>
      <Text size="md" weight="semibold">
        {t("Ready to join?")}
      </Text>
      <Button kind="secondary" onClick={onBrowserClick}>
        {t("Continue in browser")}
      </Button>
      <Button as="a" href={appUrl} Icon={PopOutIcon}>
        {t("Open in the app")}
      </Button>
    </Modal>
  );
};
