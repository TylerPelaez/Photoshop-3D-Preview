import React, { Key } from 'react';
import {useState, useCallback} from 'react';
import {NextUIProvider, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Modal, ModalContent, useDisclosure } from "@nextui-org/react";

import '../output.css';
import { GridSettings, UserSettings } from './Types';
import GridSettingsModal from './GridSettingsModal';


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
