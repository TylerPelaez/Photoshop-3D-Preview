import React, { Key } from 'react';
import {useCallback} from 'react';
import {NextUIProvider, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Modal, ModalContent, useDisclosure} from "@nextui-org/react";

import '../output.css';
import { UserSettings } from "@api/types/Settings";
import GridSettingsModal from './GridSettingsModal';
import DisplaySettingsModal from './DisplaySettingsModal';
import ContextMenu, { choiceStrings } from './ContextMenu';
import { Vector2 } from 'three';
import ControlSettingsModal from './ControlSettingsModal';
import LightIcon from './LightIcon';
import HamburgerIcon from './HamburgerIcon';

export interface AppProps {
  userSettings: UserSettings, 
  onModelLoad: Function, 
  onUpdateSettings: (val: UserSettings) => void,
  contextMenuOpen: boolean,
  hasObjectSelected: boolean,
  contextMenuPosition: Vector2,
  onContextMenuChoiceMade: (key: choiceStrings) => void,
  lightingEnabled: boolean,
  onLightingTogglePressed: () => void
}

interface ModalData {
  key: string,
  component: (onClose: () => void) => React.JSX.Element,
  disclosure: ReturnType<typeof useDisclosure>
}


function App(props: AppProps) {
  const userSettings = props.userSettings;
  
  const handleLoadButtonClick = useCallback(props.onModelLoad, [props.onModelLoad]);
  const onSettingsUpdated = useCallback(props.onUpdateSettings, [props.onUpdateSettings]);

  const modals: ModalData[] = [
    {
      key: "grid", 
      component: (onClose) => (
        <GridSettingsModal gridSettings={userSettings.gridSettings} onClose={(val) => {
          onSettingsUpdated({...userSettings, gridSettings: val});
          onClose();
        }} />
      ), 
      disclosure: useDisclosure(),
    },
    {
      key: "display", 
      component: (onClose) => (
        <DisplaySettingsModal displaySettings={userSettings.displaySettings} onClose={(val) => {
          onSettingsUpdated({...userSettings, displaySettings: val});
          onClose();
        }} />
      ), 
      disclosure: useDisclosure(),
    },
    {
      key: "controls", 
      component: (onClose) => (
        <ControlSettingsModal controlsSettings={userSettings.controlsSettings} onClose={(val) => {
          onSettingsUpdated({...userSettings, controlsSettings: val});
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
            <Button size="sm" radius="sm" color="default" title="Menu">
              <HamburgerIcon />
            </Button>
          </DropdownTrigger>
          <DropdownMenu onAction={OnDropdownMenuAction}>
            <DropdownItem key="load">Load Model</DropdownItem>
            <DropdownItem key="grid">Grid Settings</DropdownItem>
            <DropdownItem key="display">Display Settings</DropdownItem>
            <DropdownItem key="controls">Control Scheme</DropdownItem>
          </DropdownMenu>
        </Dropdown>
        <Button title="Toggle Directional Light" 
        size="sm" radius="sm" onClick={props.onLightingTogglePressed} 
        style={{float: "right", marginLeft: "8px"}} 
        isIconOnly color="default" aria-label="Lighting">
          <LightIcon fill={props.lightingEnabled ? "#FFFFFF" : "#1f1f1f"} size={24}/>
        </Button>    

        {modals.map((modal) => ( // Cuts down on some boilerplate
          <Modal key={modal.key} isOpen={modal.disclosure.isOpen} onOpenChange={modal.disclosure.onOpenChange} placement="top-center">
            <ModalContent>
              {modal.component} 
            </ModalContent>  
          </Modal>
        ))}
        {props.contextMenuOpen ? <ContextMenu hasObjectSelected={props.hasObjectSelected} position={props.contextMenuPosition} onChoiceMade={props.onContextMenuChoiceMade} /> : null}
        
      </main>
    </NextUIProvider>
  );
}

export default App
