export const uxp = require("uxp") as typeof import("uxp");
export const fs = require("fs") as typeof import("fs");

const hostName = uxp.host.name;

export const photoshop = (
  hostName === "Photoshop" ? require("photoshop") : {}
) as typeof import("photoshop");
