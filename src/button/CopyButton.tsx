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

import { useTranslation } from "react-i18next";
import useClipboard from "react-use-clipboard";
import { FC } from "react";

import CheckIcon from "../icons/Check.svg?react";
import CopyIcon from "../icons/Copy.svg?react";
import { Button, ButtonVariant } from "./Button";

interface Props {
  value: string;
  children?: JSX.Element | string;
  className?: string;
  variant?: ButtonVariant;
  copiedMessage?: string;
}

export const CopyButton: FC<Props> = ({
  value,
  children,
  className,
  variant,
  copiedMessage,
  ...rest
}) => {
  const { t } = useTranslation();
  const [isCopied, setCopied] = useClipboard(value, { successDuration: 3000 });

  return (
    <Button
      {...rest}
      variant={variant === "icon" ? "iconCopy" : variant || "copy"}
      on={isCopied}
      className={className}
      onPress={setCopied}
      iconStyle={isCopied ? "stroke" : "fill"}
      aria-label={t("Copy")}
    >
      {isCopied ? (
        <>
          {variant !== "icon" && <span>{copiedMessage || t("Copied!")}</span>}
          <CheckIcon />
        </>
      ) : (
        <>
          {variant !== "icon" && <span>{children || value}</span>}
          <CopyIcon />
        </>
      )}
    </Button>
  );
};
