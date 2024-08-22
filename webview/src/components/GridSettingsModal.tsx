import React, { useState } from "react";
import { GridSettings } from "@api/types/Settings";
import { Button, ModalHeader, ModalBody, ModalFooter, Input, Checkbox } from "@nextui-org/react";
import { isValidNumber } from "../util/util";


export default function GridSettingsModal({gridSettings, onClose}: {gridSettings: GridSettings, onClose: ((val: GridSettings) => void)}) {
  const [size, setSize] = useState<string>(gridSettings.size.toString());
  const [divisions, setDivisions] = useState<string>(gridSettings.divisions.toString());
  const [visible, setVisible] = useState<boolean>(gridSettings.visible);


  return (
    <>
      <ModalHeader className="text-small">Grid Settings</ModalHeader>
      <ModalBody>
        <Input
          onValueChange={setSize}
          autoFocus
          isInvalid={!isValidNumber(size)}
          errorMessage="Enter a number greater than 0"
          label="Grid Size"
          variant="bordered"
          size="sm"
          value={size}
        />
        <Input
          onValueChange={setDivisions}
          isInvalid={!isValidNumber(divisions)}
          pattern="[0-9]*"
          label="Grid Divisions"
          errorMessage="Enter a number greater than 0"
          variant="bordered"
          size="sm"
          value={divisions}
        />
        <div className="flex py-2 px-1 justify-between">
          <Checkbox
            size="sm"
            onValueChange={setVisible}
            classNames={{
              label: "text-small",
            }}
            isSelected={visible}
          >
            Show Grid
          </Checkbox>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button size="sm" radius="sm" disabled={!isValidNumber(size) || !isValidNumber(divisions)} color="primary" onPress={(_event) => {
            onClose({size: parseInt(size.trim(), 10), divisions: parseInt(divisions.trim(), 10), visible: visible});
          }
        }>
          Confirm
        </Button>
      </ModalFooter>
    </>
  );
}