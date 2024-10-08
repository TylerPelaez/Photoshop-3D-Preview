import React, { useState } from "react";
import { DisplaySettings } from "@api/types/Settings";
import { Button, ModalHeader, ModalBody, ModalFooter, Slider } from "@nextui-org/react";


export default function DisplaySettingsModal({displaySettings, onClose}: {displaySettings: DisplaySettings, onClose: ((val: DisplaySettings) => void)}) {
  const pctScale = Math.round(displaySettings.textureResolutionScale * 100);

  const [cameraFOV, setFOV] = useState<number>(displaySettings.cameraFOV);
  const [textureResolutionScale, setTextureResolutionScale] = useState<number>(pctScale);

  return (
    <>
      <ModalHeader className="text-small">Display Settings</ModalHeader>
      <ModalBody style={{alignItems: "center"}}>
        <Slider
          label="Camera Field of View"
          color="foreground"
          size="sm"
          minValue={1}
          maxValue={120}
          defaultValue={displaySettings.cameraFOV}
          onChangeEnd={setFOV as (arg: number | number[]) => void}
          className="max-w-sm"
        />
        <Slider
          label="Texture Resolution Scaling"
          color="foreground"
          size="sm"
          step={25}
          minValue={25}
          maxValue={100}
          defaultValue={pctScale}
          onChange={setTextureResolutionScale as (arg: number | number[]) => void}
          className="max-w-sm"
          marks={[
            {
              value: 25,
              label: "25%",
            },
            {
              value: 50,
              label: "50%",
            },
            {
              value: 75,
              label: "75%",
            },
            {
              value: 100,
              label: "100%",
            },
          ]}
        />
      </ModalBody>
      <ModalFooter>
        <Button size="sm" radius="sm" color="primary" onPress={(_event) => {
            onClose({cameraFOV, textureResolutionScale:  textureResolutionScale / 100});
          }
        }>
          Confirm
        </Button>
      </ModalFooter>
    </>
  );
}