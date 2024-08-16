import React from "react";
import { Vector2 } from "three";
import {Listbox, ListboxItem} from "@nextui-org/react";


interface ContextMenuProps {
  visible: boolean, 
  position: Vector2, 
  hasObjectSelected: boolean,
  onChoiceMade: (key: choiceStrings) => void
}

enum CONTEXT_MENU_CHOICE  {
  FOCUS = "FOCUS",
  APPLY = "APPLY",
  NOOBJECT = "NOOBJECT",
}

export type choiceStrings = keyof typeof CONTEXT_MENU_CHOICE;

export default function ContextMenu(props: ContextMenuProps) {
  return (
    <div className="rounded-small bg-content1"  style={{
      display: props.visible ? "block" : "none",
      position: "absolute",
      top:  `${props.position.y}px`,
      left: `${props.position.x}px`,
      color: "default"
    }}>
      <Listbox disabledKeys={!props.hasObjectSelected ?[CONTEXT_MENU_CHOICE.NOOBJECT] : []} aria-label="Context Menu" color="default" onAction={(key) => {
          props.onChoiceMade(key as choiceStrings);
        }
      }>
        {!props.hasObjectSelected ? (
          <ListboxItem key={CONTEXT_MENU_CHOICE.NOOBJECT}>No Object Selected</ListboxItem>
        ) : ([
          <ListboxItem key={CONTEXT_MENU_CHOICE.FOCUS}>Focus</ListboxItem>,
          <ListboxItem key={CONTEXT_MENU_CHOICE.APPLY}>Apply Active Document</ListboxItem>
        ])}
      </Listbox>
    </div>
  )
}