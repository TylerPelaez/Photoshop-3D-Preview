import React, { Key } from 'react';
import {useState, useCallback} from 'react';
import {NextUIProvider, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Modal, ModalContent, useDisclosure } from "@nextui-org/react";

import '../output.css';
import { GridSettings, UserSettings } from './Types';
import GridSettingsModal from './GridSettingsModal';
import ContextMenu, { choiceStrings } from './ContextMenu';
import { Vector2 } from 'three';

export interface AppProps {
  initialUserSettings: UserSettings, 
  onModelLoad: Function, 
  onUpdateGridSettings: (val: GridSettings) => void,
  contextMenuOpen: boolean,
  contextMenuPosition: Vector2,
  onContextMenuChoiceMade: (key: choiceStrings) => void
}


function App(props: AppProps) {
  const [userSettings, setUserSettings] = useState<UserSettings>(props.initialUserSettings);
  
  const handleLoadButtonClick = useCallback(props.onModelLoad, [props.onModelLoad]);
  const onGridSettingsUpdated = useCallback(props.onUpdateGridSettings, [props.onUpdateGridSettings]);

  const {isOpen: isModalOpen, onOpen: onModalOpen, onOpenChange: onModalOpenChange} = useDisclosure();
  const {isOpen: isCameraModalOpen, onOpen: onCameraModalOpen, onOpenChange: onCameraModalOpenChange} = useDisclosure();


  const OnDropdownMenuAction = function(key: Key) {
    if (key == "load") {
      handleLoadButtonClick();
    } else if (key == "grid") {
      onModalOpen();
    } else if (key == "camera") {
      onCameraModalOpen();
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
            <DropdownItem key="camera">Camera Settings</DropdownItem>
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
        <Modal
          isOpen={isCameraModalOpen}
          onOpenChange={onCameraModalOpenChange}
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
        <ContextMenu visible={props.contextMenuOpen} position={props.contextMenuPosition} onChoiceMade={props.onContextMenuChoiceMade} />
      </main>
    </NextUIProvider>
  );
}

export default App