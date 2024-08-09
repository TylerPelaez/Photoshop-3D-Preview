import React, { Key } from 'react';
import {useState, useCallback} from 'react';
import {NextUIProvider, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Checkbox, Input} from "@nextui-org/react";

import '../output.css';
import { div } from 'three/webgpu';

export interface UserSettings {
  gridSettings: GridSettings;
}


export interface GridSettings {
  size: number;
  divisions: number;
  visible: boolean;
}



function isValidNumber(value: string) {
  value = value.trim();
  if (!value) {
    return false;
  }
  value = value.replace(/^0+/, "") || "0";
  var n = Math.floor(Number(value));
  return n !== Infinity && String(n) === value && n > 0;
};


function GridSettingsModal({gridSettings, onClose}: {gridSettings: GridSettings, onClose: ((val: GridSettings) => void)}) {
  const [size, setSize] = useState<string>(gridSettings.size.toString());
  const [divisions, setDivisions] = useState<string>(gridSettings.divisions.toString());
  const [visible, setVisible] = useState<boolean>(gridSettings.visible);


  return (
    <>
      <ModalHeader className="flex flex-col gap-1">Grid Settings</ModalHeader>
      <ModalBody>
        <Input
          onValueChange={setSize}
          autoFocus
          isInvalid={!isValidNumber(size)}
          errorMessage="Enter a number greater than 0"
          label="Grid Size"
          variant="bordered"
          value={size}
        />
        <Input
          onValueChange={setDivisions}
          isInvalid={!isValidNumber(divisions)}
          pattern="[0-9]*"
          label="Grid Divisions"
          errorMessage="Enter a number greater than 0"
          variant="bordered"
          value={divisions}
        />
        <div className="flex py-2 px-1 justify-between">
          <Checkbox
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
        <Button disabled={!isValidNumber(size) || !isValidNumber(divisions)} color="primary" onPress={(e) => {
            onClose({size: parseInt(size.trim(), 10), divisions: parseInt(divisions.trim(), 10), visible: visible});
          }
        }>
          Confirm
        </Button>
      </ModalFooter>
    </>
  );
}



function App({initialUserSettings, onModelLoad, onUpdateGridSettings}: {initialUserSettings: UserSettings, onModelLoad: Function, onUpdateGridSettings: (val: GridSettings) => void}) {
  const [userSettings, setUserSettings] = useState<UserSettings>(initialUserSettings);
  
  const handleLoadButtonClick = useCallback(onModelLoad, [onModelLoad]);
  const onGridSettingsUpdated = useCallback(onUpdateGridSettings, [onUpdateGridSettings]);

  const {isOpen: isModalOpen, onOpen: onModalOpen, onOpenChange: onModalOpenChange} = useDisclosure();


  const OnDropdownMenuAction = function(key: Key) {
    if (key == "load") {
      handleLoadButtonClick();
    } else if (key == "grid") {
      onModalOpen();
    }
  }

  return (
    <NextUIProvider>
      <main className="dark text-foreground">
        <Dropdown size="sm" radius="sm">
          <DropdownTrigger>
            <Button size="sm" radius="sm" color="default">Menu</Button>
          </DropdownTrigger>
          <DropdownMenu onAction={OnDropdownMenuAction}>
            <DropdownItem key="load">Load Model</DropdownItem>
            <DropdownItem key="grid">Grid Settings</DropdownItem>
          </DropdownMenu>
        </Dropdown>
        <Modal
          isOpen={isModalOpen}
          onOpenChange={onModalOpenChange}
          placement="top-center"
        >
          <ModalContent>
            {(onClose) => (
                <GridSettingsModal gridSettings={userSettings.gridSettings} onClose={(val) => {
                  setUserSettings({...userSettings, gridSettings: val});
                  onGridSettingsUpdated(val);
                  onClose();
                }} />
              )
            }
          </ModalContent>
        </Modal>
      </main>
    </NextUIProvider>
  );
}

export default App
