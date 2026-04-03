#!/bin/bash

set -e
echo "Starting build process..."

if ! command -v pnpm &> /dev/null
then
    echo "pnpm could not be found. Please install it with 'npm install -g pnpm'."
    exit 1
fi

echo "Installing dependencies..."
pnpm install

echo "Building extension for Firefox..."
pnpm build:firefox

echo "Build complete! Production files are in '.output/firefox-mv3'."
