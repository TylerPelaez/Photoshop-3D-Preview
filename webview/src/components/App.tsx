import React, { Key } from 'react';
import {useState, useCallback} from 'react';
import {NextUIProvider, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Modal, ModalContent, useDisclosure} from "@nextui-org/react";

import '../output.css';
import { GridSettings, UserSettings } from '@api/Settings';
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

interface ModalData {
  key: string,
  component: (onClose: () => void) => React.JSX.Element,
  disclosure: ReturnType<typeof useDisclosure>
}


function App(props: AppProps) {
  const [userSettings, setUserSettings] = useState<UserSettings>(props.initialUserSettings);
  
  const handleLoadButtonClick = useCallback(props.onModelLoad, [props.onModelLoad]);
  const onGridSettingsUpdated = useCallback(props.onUpdateGridSettings, [props.onUpdateGridSettings]);

  const modals: ModalData[] = [
    {
      key: "grid", 
      component: (onClose) => (
        <GridSettingsModal gridSettings={userSettings.gridSettings} onClose={(val) => {
          setUserSettings({...userSettings, gridSettings: val});
          onGridSettingsUpdated(val);
          onClose();
        }} />
      ), 
      disclosure: useDisclosure(),
    },
    {
      key: "camera", 
      component: (onClose) => (
        <GridSettingsModal gridSettings={userSettings.gridSettings} onClose={(val) => {
          setUserSettings({...userSettings, gridSettings: val});
          onGridSettingsUpdated(val);
          onClose();
        }} />
      ), 
      disclosure: useDisclosure(),
    },
    {
      key: "controls", 
      component: (onClose) => (
        <GridSettingsModal gridSettings={userSettings.gridSettings} onClose={(val) => {
          setUserSettings({...userSettings, gridSettings: val});
          onGridSettingsUpdated(val);
          onClose();
        }} />
      ), 
      disclosure: useDisclosure(),
    }
  ]


  const OnDropdownMenuAction = function(key: Key) {
    if (key == "load") {
      handleLoadButtonClick();
    } else {
      const modal = modals.find(val => val.key == key);
      if (modal) {
        modal.disclosure.onOpen();
      }
    }
  }

  return (
    <NextUIProvider disableAnimation>
      <main className="dark text-foreground">
        <Dropdown size="sm" radius="sm">
          <DropdownTrigger>
            <Button size="sm" radius="sm" color="default">Menu</Button>
          </DropdownTrigger>
          <DropdownMenu onAction={OnDropdownMenuAction}>
            <DropdownItem key="load">Load Model</DropdownItem>
            <DropdownItem key="grid">Grid Settings</DropdownItem>
            <DropdownItem key="camera">Camera Settings</DropdownItem>
            <DropdownItem key="controls">Control Scheme</DropdownItem>
          </DropdownMenu>
        </Dropdown>
        {modals.map((modal) => ( // Cuts down on some boilerplate
          <Modal isOpen={modal.disclosure.isOpen} onOpenChange={modal.disclosure.onOpenChange} placement="top-center">
            <ModalContent>
              {modal.component}  
            </ModalContent>  
          </Modal>
        ))}
        <ContextMenu visible={props.contextMenuOpen} position={props.contextMenuPosition} onChoiceMade={props.onContextMenuChoiceMade} />
      </main>
    </NextUIProvider>
  );
}

export default App
