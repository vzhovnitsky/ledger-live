import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { DeviceModelId } from "@ledgerhq/devices";
import manager from "@ledgerhq/live-common/manager/index";
import { FirmwareUpdateContext, DeviceInfo } from "@ledgerhq/types-live";
import { hasFinalFirmware } from "@ledgerhq/live-common/hw/hasFinalFirmware";
import { command } from "~/renderer/commands";
import { getCurrentDevice } from "~/renderer/reducers/devices";
import TrackPage from "~/renderer/analytics/TrackPage";
import Track from "~/renderer/analytics/Track";
import getCleanVersion from "~/renderer/screens/manager/FirmwareUpdate/getCleanVersion";
import Box from "~/renderer/components/Box";
import Text from "~/renderer/components/Text";
import ProgressCircle from "~/renderer/components/ProgressCircle";
import Interactions from "~/renderer/icons/device/interactions";
import { mockedEventEmitter } from "~/renderer/components/debug/DebugMock";
import { StepProps } from "../";
import { getEnv } from "@ledgerhq/live-common/env";

import Animation from "~/renderer/animations";
import { getDeviceAnimation } from "~/renderer/components/DeviceAction/animations";
import { AnimationWrapper } from "~/renderer/components/DeviceAction/rendering";
import useTheme from "~/renderer/hooks/useTheme";

const Container = styled(Box).attrs(() => ({
  alignItems: "center",
  fontSize: 4,
  color: "palette.text.shade100",
  px: 7,
}))``;

const Title = styled(Box).attrs(() => ({
  ff: "Inter|Regular",
  fontSize: 5,
  mb: 3,
}))``;

const Identifier = styled(Box).attrs(p => ({
  bg: "palette.background.default",
  borderRadius: 1,
  color: "palette.text.shade100",
  ff: "Inter|SemiBold",
  fontSize: 4,
  mt: 2,
  px: 4,
  py: 3,
}))`
  border: 1px dashed ${p => p.theme.colors.palette.divider};
  cursor: text;
  user-select: text;
  min-width: 325px;
  text-align: center;
  word-break: break-all;
`;

const Body = ({
  displayedOnDevice,
  progress,
  deviceModelId,
  firmware,
  deviceInfo,
}: {
  displayedOnDevice: boolean;
  progress: number;
  deviceModelId: DeviceModelId;
  firmware: FirmwareUpdateContext;
  deviceInfo: DeviceInfo;
}) => {
  const { t } = useTranslation();
  const type = useTheme("colors.palette.type");

  const isBlue = deviceModelId === "blue";

  if (!displayedOnDevice) {
    return (
      <>
        <Text ff="Inter|Regular" textAlign="center" color="palette.text.shade80">
          {t("manager.firmware.downloadingUpdateDesc")}
        </Text>
        <Box my={5}>
          <ProgressCircle progress={progress} size={56} />
        </Box>
      </>
    );
  }

  if (displayedOnDevice && firmware.osu.hash) {
    return (
      <>
        <Track event={"FirmwareUpdateConfirmIdentifierDisplayed"} onMount />
        <Text ff="Inter|Regular" textAlign="center" color="palette.text.shade80">
          {t("manager.modal.confirmIdentifierText")}
        </Text>
        <Box mx={7} mt={5} mb={isBlue ? 0 : 5}>
          <Text ff="Inter|SemiBold" textAlign="center" color="palette.text.shade80">
            {t("manager.modal.identifier")}
          </Text>
          <Identifier>
            {firmware.osu &&
              manager
                .formatHashName(firmware.osu.hash, deviceModelId, deviceInfo)
                .map((hash, i) => <span key={`${i}-${hash}`}>{hash}</span>)}
          </Identifier>
        </Box>
        {isBlue ? (
          <Box mt={4}>
            <Interactions
              wire="wired"
              type={deviceModelId}
              width={150}
              screen="validation"
              action="accept"
            />
          </Box>
        ) : (
          <AnimationWrapper>
            <Animation animation={getDeviceAnimation(deviceModelId, type, "validate")} />
          </AnimationWrapper>
        )}
      </>
    );
  }

  return (
    <>
      <Track event={"FirmwareUpdateConfirmNewFirwmare"} onMount />
      <Box mx={7} mt={5} mb={isBlue ? 0 : 5}>
        <Text ff="Inter|SemiBold" textAlign="center" color="palette.text.shade80">
          {t("manager.modal.confirmUpdate")}
        </Text>
      </Box>
      {isBlue ? (
        <Box mt={4}>
          <Interactions
            wire="wired"
            type={deviceModelId}
            width={150}
            screen="validation"
            action="accept"
          />
        </Box>
      ) : (
        <AnimationWrapper>
          <Animation animation={getDeviceAnimation(deviceModelId, type, "validate")} />
        </AnimationWrapper>
      )}
    </>
  );
};

type Props = StepProps;

const StepFullFirmwareInstall = ({
  firmware,
  deviceModelId,
  deviceInfo,
  transitionTo,
  setError,
}: Props) => {
  const { t } = useTranslation();
  const device = useSelector(getCurrentDevice);
  const [progress, setProgress] = useState(0);
  const [displayedOnDevice, setDisplayedOnDevice] = useState(false);

  // didMount effect
  useEffect(() => {
    if (!firmware.osu) {
      transitionTo("finish");
      return;
    }

    const sub = (getEnv("MOCK")
      ? mockedEventEmitter()
      : command("firmwarePrepare")({
          deviceId: device ? device.deviceId : "",
          firmware,
        })
    ).subscribe({
      next: ({ progress, displayedOnDevice: displayed }) => {
        setProgress(progress);
        setDisplayedOnDevice(displayed);
      },
      complete: () => {
        transitionTo(
          firmware.shouldFlashMCU || hasFinalFirmware(firmware.final) ? "updateMCU" : "updating",
        );
      },
      error: error => {
        setError(error);
        transitionTo("finish");
      },
    });

    return () => {
      if (sub) sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasHash = !!firmware?.osu?.hash;

  return (
    <Container data-test-id="firmware-update-download-progress">
      <Title>
        {!displayedOnDevice
          ? t("manager.modal.steps.downloadingUpdate")
          : hasHash
          ? t("manager.modal.confirmIdentifier")
          : t("manager.modal.newFirmware", { version: getCleanVersion(firmware.final.name) })}
      </Title>
      <TrackPage category="Manager" name="InstallFirmware" />
      <Body
        deviceModelId={deviceModelId}
        deviceInfo={deviceInfo}
        displayedOnDevice={displayedOnDevice}
        firmware={firmware}
        progress={progress}
      />
    </Container>
  );
};

export default StepFullFirmwareInstall;
