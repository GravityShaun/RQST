#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DERIVED_DATA_DIR="${HOME}/Library/Developer/Xcode/DerivedData"

if [[ -d "${DERIVED_DATA_DIR}" ]]; then
  find "${DERIVED_DATA_DIR}" -maxdepth 1 -type d -name 'RQST-*' -exec rm -rf {} +
fi

rm -f "${APP_DIR}/.expo/xcodebuild.log" "${APP_DIR}/.expo/xcodebuild-error.log"

printf 'Cleared RQST iOS derived data and Expo Xcode logs.\n'
