# ActivityInfo Helper - Firefox Submission Documentation

This document provides instructions for building the ActivityInfo Helper extension from source for verification by Firefox Add-on reviewers.

## 1. Operating System and Build Environment Requirements

- **Operating System:** Windows 10/11, macOS (Intel or Apple Silicon), or Linux (Ubuntu 20.04+ or similar).
- **Node.js:** Version 20.x (LTS) or higher is recommended.
- **Package Manager:** `pnpm` version 10.33.0 or higher.

## 2. Program Installation Instructions

### Node.js
If not already installed, download and install Node.js from [nodejs.org](https://nodejs.org/). 
Verify installation:
```bash
node --version
```

### pnpm
This project uses `pnpm`. To install it globally, run:
```bash
npm install -g pnpm@10.33.0
```
Verify installation:
```bash
pnpm --version
```

## 3. Step-by-Step Build Instructions

Follow these steps to create an exact copy of the add-on code:

1.  **Extract the Source Code:**
    Extract the provided source code archive into a directory of your choice.

2.  **Open Terminal:**
    Navigate to the root directory of the extracted source code.

3.  **Install Dependencies:**
    Run the following command to install all necessary dependencies using the lockfile:
    ```bash
    pnpm install
    ```

4.  **Build for Firefox:**
    Execute the build script specifically configured for the Firefox browser:
    ```bash
    pnpm build:firefox
    ```

5.  **Locate the Build Output:**
    Once the build process completes, the production-ready extension code will be available in the following directory:
    ```
    .output/firefox-mv3
    ```

## 4. Build Script

A convenience build script is included in the root directory: `build.sh`. 
To execute all necessary technical steps in one sequence, you can run:

```bash
chmod +x build.sh
./build.sh
```

Alternatively, you can run:
```bash
pnpm install && pnpm build:firefox
```

The `pnpm build:firefox` command internally executes `wxt build -b firefox`, which handles:
- TypeScript compilation.
- Asset bundling and optimization (via Vite).
- Manifest generation for Firefox (Manifest V3).
- Resource copying.

## 5. Verification

To verify the build, you can load the resulting `.output/firefox-mv3` folder into Firefox:
1. Open Firefox and go to `about:debugging`.
2. Click "This Firefox".
3. Click "Load Temporary Add-on...".
4. Select the `manifest.json` file inside the `.output/firefox-mv3` directory.
