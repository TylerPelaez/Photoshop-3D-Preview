## About
This is the repository for the 3D Preview Photoshop Plugin, developed by Tyler Peláez. This plugin allows the ability to load a 3D model into a panel in photoshop, apply textures to it directly from photoshop, and see updates in real time as the texture is modified. This is a very convenient workflow for 3D Texturing tasks which can benefit from Photoshop's robust featureset, or for people who don't want to purchase Substance Painter to do simple texturing.  

## Overview

The Plugin consists of 3 components:
- The Typescript-based UXP Plugin Panel (located in `src/`)
- The Typescript-based Webpage is loaded by the UXP Plugin to render the 3D Viewport and UI leveraging three.js and React (located in `webview/`)
- The C++ based UXP Hybrid Module containing utility functionality being run in C++ for faster image processing performance. (located in `src/hybrid/src`)

## Prerequisites

- [Node.js 18](https://nodejs.org/en/) or later
- [Adobe UXP Developer Tool (aka UDT)](https://developer.adobe.com/photoshop/uxp/2022/guides/devtool/installation/)
- Package manager
  - NPM (comes with Node.js)

## Quick Start
Run the plugin in hot reload mode for development with UDT (see below)
- `npm run dev`

Run the localhost webview server in hot reload mode
- `cd webview/`
- `npm run dev`

Load the plugin via UXP Developer Tools (See Below)

## UDT Setup

_Install Note: The Adobe UXP Developer Tools (UDT) can be downloaded from the Adobe CC app_

### Add Plugin

1. Open the Adobe UXP Developer Tool (2.0 or later)
2. Click the `Add Plugin` button in the top right corner
3. Select the `manifest.json` file in the `dist` folder

### Load and Debug Plugin

1. Click `Load` button on your plugin item
2. Click `Debug` button on your plugin item

_Note: You only need to "Load" a plugin, do not use the "Load and Watch" feature. The bulit-in UDT file watcher aka "Load and Watch" does not reliably update on changes so we recommend avoiding it. Instead, Bolt UXP comes with it's own built-in WebSocket system to trigger a reload on each update which is more consistent and less error-prone._

## Other

Build & Package the plugin as a CCX for delivery (separate CCX files for each host are generated due to current UXP requirements)
- `npm run ccx`

Thanks to the UXP Bolt Project for much of the build config and project setup: https://hyperbrew.co/resources/bolt-uxp/ 