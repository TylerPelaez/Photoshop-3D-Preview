import React, { useState } from "react";
import { ControlScheme, ControlSchemeType, ControlsSettings, MouseButton } from "@api/types/Settings";
import { Button, ModalHeader, ModalBody, ModalFooter, Tabs, Tab,  Chip, Listbox, ListboxItem} from "@nextui-org/react";
import { BuiltInSchemes } from "../util/util";

function buttonToText(button: MouseButton): string {
  return ["LMB", "MMB", "RMB"][button];
}


function capitalize(val: string) {
    return val.charAt(0).toUpperCase() + val.toLowerCase().slice(1);
}


function getTabContent(scheme: ControlScheme, action: string) {
  let label = action;  
  let input = action == "Pan" ? scheme.pan : action == "Zoom" ? scheme.zoom : action == "Rotate" ? scheme.rotate : action == "Move Light" ? scheme.light : undefined;
  let chipContent = "";
  if (!input) {
    chipContent = "Disabled"
  } else {
    chipContent = input.key ? capitalize(input.key) : "";
    if (chipContent == " ") chipContent = "Space";
    if (chipContent != "") chipContent += " + ";
    
    chipContent += buttonToText(input.mouseButton);
  }

  return (<ListboxItem 
    isReadOnly={true} 
    shouldHighlightOnFocus={false} 
    key={action} 
    style={{cursor: "default", display: "flex"}}
    classNames={{
      base: "w-full data-[hover=true]:bg-background flex",
      wrapper: "w-full flex",
      title: "flex justify-between"
    }}>
      <div>{label}:</div>
      <div style={{display: "flex", justifyContent: "space-between"}}>
        {action == "Zoom" ? <Chip style={{marginLeft: "2px", marginRight: "2px"}} size="sm" radius="sm">Scroll</Chip> : null}
        <Chip style={{marginLeft: "2px", marginRight: "2px"}} size="sm" radius="sm">{chipContent}</Chip>
        </div>
    </ListboxItem>);
}

export default function ControlSettingsModal({controlsSettings, onClose}: {controlsSettings: ControlsSettings, onClose: ((val: ControlsSettings) => void)}) {
  const [selected, setSelected] = useState<number>(controlsSettings.scheme as number);

  let tabs: JSX.Element[] = []
  
  for (let schemeType of [0, 1, 2]) {
    let scheme = BuiltInSchemes.get(schemeType)!;

    tabs.push(
      <Tab className="flex justify-center w-full" key={schemeType} title={capitalize(ControlSchemeType[schemeType])}>
        <Listbox shouldHighlightOnFocus={false} className="w-full max-w-[180px] border-small px-1 py-2 rounded-small border-default-200 dark:border-default-100">
          {["Pan", "Rotate", "Zoom", "Move Light"].map(action => getTabContent(scheme, action))}
        </Listbox>
      </Tab>
    );
  }


  return (
    <>
      <ModalHeader className="text-small ">Control Schemes</ModalHeader>
      <ModalBody>
        <Tabs
              fullWidth
              size="sm"
              selectedKey={selected.toString()}
              onSelectionChange={(key: any) =>  {
                let val = typeof key === "string" ? parseInt(key as string) : key as number
                setSelected(val);
              }}
            >
          {tabs.map(v => v)}
        </Tabs>
      </ModalBody>
      <ModalFooter>
        <Button size="sm" radius="sm" color="primary" onPress={(_event) => {
            onClose({...controlsSettings, scheme: selected});
          }
        }>
          Confirm
        </Button>
      </ModalFooter>
    </>
  );
}

