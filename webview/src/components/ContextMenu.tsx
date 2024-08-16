import React, { useEffect, useRef, useState } from "react";
import { Vector2 } from "three";
import {Listbox, ListboxItem} from "@nextui-org/react";


interface ContextMenuProps {
  position: Vector2, 
  hasObjectSelected: boolean,
  onChoiceMade: (key: choiceStrings) => void
}

enum CONTEXT_MENU_CHOICE  {
  FOCUS = "FOCUS",
  APPLY = "APPLY",
  NOOBJECT = "NOOBJECT",
}

const offsetX = 4;
const offsetY = 4;

export type choiceStrings = keyof typeof CONTEXT_MENU_CHOICE;

export default function ContextMenu(props: ContextMenuProps) {
  const refContainer = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({
    x: props.position.x - offsetX,
    y: props.position.y - offsetY,
  });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (refContainer.current) {
      const desiredPosX = props.position.x - offsetX;
      const desiredPosY = props.position.y - offsetY;

      setPosition({
        x: desiredPosX + refContainer.current.offsetWidth > window.innerWidth ? (props.position.x + offsetX) - refContainer.current.offsetWidth : desiredPosX,
        y: desiredPosY + refContainer.current.offsetHeight > window.innerHeight ? (props.position.y + offsetY) - refContainer.current.offsetHeight : desiredPosY,
      });
      setVisible(true);
    }
  }, [props.position, refContainer, visible]);

  return (
    <div onContextMenu={(e) => e.preventDefault()} className="rounded-small bg-content1"  style={{
      display: visible ? "block" : "none",
      position: "absolute",
      top:  `${position.y}px`,
      left: `${position.x}px`,
      color: "default"
    }}
    ref={refContainer}
    >
      <Listbox disabledKeys={!props.hasObjectSelected ?[CONTEXT_MENU_CHOICE.NOOBJECT] : []} aria-label="Context Menu" color="default" onAction={(key) => {
          props.onChoiceMade(key as choiceStrings);
        }
      }>
        {!props.hasObjectSelected ? (
          <ListboxItem key={CONTEXT_MENU_CHOICE.NOOBJECT}>No Object Selected</ListboxItem>
        ) : ([
          <ListboxItem key={CONTEXT_MENU_CHOICE.APPLY}>Apply Active Document</ListboxItem>,
          <ListboxItem key={CONTEXT_MENU_CHOICE.FOCUS}>Focus</ListboxItem>
        ])}
      </Listbox>
    </div>
  )
}