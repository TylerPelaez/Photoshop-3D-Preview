import React from "react";



export default function HamburgerIcon({size, height, width}: {fill? : string, size?: number, height?: number, width?: number}) {
  return (
    <svg
      width={size || width || 24}
      height={size || height || 24}
      fill="#ffffff"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
    >
      <path 
      d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
    </svg>
  );
};