#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/mobile"
PROFILE="${EAS_PROFILE:-development}"
EAS_CLI_PACKAGE="${EAS_CLI_PACKAGE:-eas-cli@latest}"
AUTO_SUBMIT="${EAS_AUTO_SUBMIT:-}"

if [[ -n "${CI:-}" ]]; then
  DEFAULT_NON_INTERACTIVE=1
else
  DEFAULT_NON_INTERACTIVE=0
fi

NON_INTERACTIVE="${EAS_NON_INTERACTIVE:-$DEFAULT_NON_INTERACTIVE}"

if [[ ! -f "$PROJECT_ROOT/app.config.ts" ]]; then
  echo "Could not find mobile/app.config.ts. Run this from the RQST root with: bash submit-ios.sh" >&2
  exit 1
fi

cd "$PROJECT_ROOT"
PROJECT_ROOT_REAL="$(pwd -P)"

node - <<'NODE'
const fs = require('node:fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const easJson = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
const appConfig = fs.readFileSync('app.config.ts', 'utf8');
const issues = [];

if (packageJson.name !== '@rqst/mobile') {
  issues.push(`expected mobile/package.json name to be @rqst/mobile, found ${packageJson.name || '(missing)'}`);
}

if (packageJson.main !== 'expo-router/entry') {
  issues.push(`expected the mobile Expo entrypoint expo-router/entry, found ${packageJson.main || '(missing)'}`);
}

if (!packageJson.dependencies?.expo || !packageJson.dependencies?.['react-native']) {
  issues.push('mobile/package.json must contain expo and react-native dependencies.');
}

if (!appConfig.includes('slug: "rqst"') || !appConfig.includes('owner: "gravshaun"')) {
  issues.push('mobile/app.config.ts does not look like the RQST Expo app config.');
}

if (!easJson.build) {
  issues.push('mobile/eas.json is missing build profiles.');
}

if (fs.existsSync('../desktop/src-tauri/tauri.conf.json') && fs.existsSync('tauri.conf.json')) {
  issues.push('current directory appears to be a Tauri project, not the mobile Expo app.');
}

if (!fs.existsSync('ios/Podfile') || !fs.existsSync('ios/RQST.xcodeproj')) {
  issues.push('mobile native iOS project files were not found.');
}

if (issues.length) {
  console.error('Refusing to run EAS outside the RQST mobile Expo app:\n');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}
NODE

echo "EAS project directory: $PROJECT_ROOT_REAL"
echo "EAS app package: @rqst/mobile"

validate_production_config() {
  node - <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const parseEnv = source => {
  const out = {};
  for (const rawLine of String(source || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
};

const envFiles = ['.env.production', '.env'];
const fileEnv = envFiles.reduce((out, envFile) => {
  const envFilePath = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(envFilePath)) return out;
  return { ...out, ...parseEnv(fs.readFileSync(envFilePath, 'utf8')) };
}, {});
const env = { ...fileEnv, ...process.env };
const get = key => String(env[key] || '').trim();
const issues = [];
const warnings = [];

const apiBaseUrl = get('EXPO_PUBLIC_RQST_API_URL');
const googleMapsApiKey = get('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');
const appConfigPath = path.resolve(process.cwd(), 'app.config.ts');
const appConfig = fs.readFileSync(appConfigPath, 'utf8');
const infoPlistPath = path.resolve(process.cwd(), 'ios/RQST/Info.plist');
const infoPlist = fs.existsSync(infoPlistPath) ? fs.readFileSync(infoPlistPath, 'utf8') : '';

const isHttpsUrl = value => value.startsWith('https://');

if (!apiBaseUrl) {
  issues.push(
    'EXPO_PUBLIC_RQST_API_URL is missing. TestFlight production builds should not use the local API fallback.',
  );
} else if (!isHttpsUrl(apiBaseUrl)) {
  issues.push('EXPO_PUBLIC_RQST_API_URL must use https:// for TestFlight production builds.');
}

if (!googleMapsApiKey) {
  warnings.push(
    'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is missing. Map screens may not work correctly in production builds.',
  );
}

if (!appConfig.includes('bundleIdentifier: "com.gravshaun.rqst"')) {
  issues.push('app.config.ts is missing the expected iOS bundle identifier com.gravshaun.rqst.');
}

if (!appConfig.includes('scheme: "rqst"')) {
  issues.push('app.config.ts is missing the expected rqst URL scheme.');
}

if (infoPlist) {
  if (!infoPlist.includes('<string>rqst</string>')) {
    issues.push('Info.plist is missing the rqst URL scheme. Rebuild native config before shipping TestFlight.');
  }

  if (!infoPlist.includes('<string>RQST</string>')) {
    warnings.push('Info.plist does not appear to contain the RQST display name.');
  }
} else {
  warnings.push('ios/RQST/Info.plist was not found. EAS can still build from config, but native build-number sync was skipped.');
}

if (issues.length) {
  console.error('Production mobile validation failed:\n');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  if (warnings.length) {
    console.error('\nWarnings:');
    for (const warning of warnings) {
      console.error(`- ${warning}`);
    }
  }
  process.exit(1);
}

if (warnings.length) {
  console.warn('Production mobile validation warnings:');
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}
NODE
}

if [[ "$PROFILE" == "production" ]]; then
  validate_production_config
fi

if [[ -f "$PROJECT_ROOT/scripts/sync-ios-app-icon.sh" ]]; then
  echo "Syncing App Store icon from mobile/assets/icon.png..."
  bash "$PROJECT_ROOT/scripts/sync-ios-app-icon.sh"
fi

if ! node - <<'NODE'
const fs = require('node:fs');
const config = fs.readFileSync('app.config.ts', 'utf8');
process.exit(/projectId:\s*["'][^"']+["']/.test(config) ? 0 : 1);
NODE
then
  echo "EAS project is not configured yet. Running eas init..."
  npx --yes "$EAS_CLI_PACKAGE" init
fi

APP_CONFIG_BUILD_NUMBER="$(node - <<'NODE'
const fs = require('node:fs');
const source = fs.readFileSync('app.config.ts', 'utf8');
const match = source.match(/buildNumber:\s*["']([^"']+)["']/);
process.stdout.write(match ? match[1] : '0');
NODE
)"
APP_VERSION_SOURCE="$(node - <<'NODE'
const fs = require('node:fs');
const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
process.stdout.write(String(eas.cli?.appVersionSource || 'local'));
NODE
)"
PROFILE_AUTO_INCREMENT="$(node - "$PROFILE" <<'NODE'
const fs = require('node:fs');
const profile = process.argv[2];
const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
const value = eas.build?.[profile]?.autoIncrement;
process.stdout.write(value === true || value === 'true' ? 'true' : 'false');
NODE
)"
NATIVE_INFO_PLIST="ios/RQST/Info.plist"
BASE_BUILD_NUMBER="${IOS_BUILD_BASE:-1.0.0}"

if [[ "$APP_VERSION_SOURCE" == "remote" ]]; then
  if [[ "$PROFILE_AUTO_INCREMENT" != "true" ]]; then
    echo "eas.json uses remote app versioning, but build profile \"$PROFILE\" does not have autoIncrement enabled." >&2
    echo "Set build.$PROFILE.autoIncrement to true so each iOS build gets a new build number." >&2
    exit 1
  fi
  echo "Using EAS remote app versioning; profile \"$PROFILE\" will auto-increment the iOS build number."
elif [[ -d "ios" ]]; then
  if ! command -v xcrun >/dev/null 2>&1; then
    echo "xcrun is required to update the native iOS build number." >&2
    exit 1
  fi

  NATIVE_PROJECT_BUILD_NUMBER="$(cd ios && xcrun agvtool what-version -terse)"
  NATIVE_PLIST_BUILD_NUMBER="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$NATIVE_INFO_PLIST")"
  CURRENT_BUILD_NUMBER="$(node -e "
const base = process.argv[1];
const rawValues = process.argv.slice(2);

const normalize = value => {
  const parts = String(value || '').trim().split('.').filter(Boolean);
  if (!parts.length || parts.length > 3) return null;
  const ints = parts.map(part => (/^[0-9]+$/.test(part) ? Number.parseInt(part, 10) : NaN));
  if (ints.some(part => !Number.isInteger(part) || part < 0)) return null;
  while (ints.length < 3) ints.push(0);
  return ints;
};

const format = ints => ints.join('.');
const compare = (left, right) => {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
};

const fallback = normalize(base) || [1, 0, 0];
const normalizedValues = rawValues.map(normalize).filter(Boolean);
const current = normalizedValues.reduce((best, candidate) => (compare(candidate, best) > 0 ? candidate : best), fallback);
process.stdout.write(format(current));
" "$BASE_BUILD_NUMBER" "$APP_CONFIG_BUILD_NUMBER" "$NATIVE_PROJECT_BUILD_NUMBER" "$NATIVE_PLIST_BUILD_NUMBER")"
  NEXT_BUILD_NUMBER="$(node -e "
const parts = String(process.argv[1]).split('.').map(part => Number.parseInt(part, 10));
while (parts.length < 3) parts.push(0);
parts[2] += 1;
process.stdout.write(parts.slice(0, 3).join('.'));
" "$CURRENT_BUILD_NUMBER")"

  (
    cd ios
    xcrun agvtool new-version -all "$NEXT_BUILD_NUMBER" >/dev/null
  )
else
  CURRENT_BUILD_NUMBER="$(node -e "
const value = String(process.argv[1] || '').trim();
const fallback = String(process.argv[2] || '1.0.0').trim();
const normalize = input => {
  const parts = input.split('.').filter(Boolean);
  if (!parts.length || parts.length > 3 || parts.some(part => !/^[0-9]+$/.test(part))) return null;
  while (parts.length < 3) parts.push('0');
  return parts.map(part => String(Number.parseInt(part, 10))).join('.');
};
process.stdout.write(normalize(value) || normalize(fallback) || '1.0.0');
" "$APP_CONFIG_BUILD_NUMBER" "$BASE_BUILD_NUMBER")"
  NEXT_BUILD_NUMBER="$(node -e "
const parts = String(process.argv[1]).split('.').map(part => Number.parseInt(part, 10));
while (parts.length < 3) parts.push(0);
parts[2] += 1;
process.stdout.write(parts.slice(0, 3).join('.'));
" "$CURRENT_BUILD_NUMBER")"
fi

if [[ "$APP_VERSION_SOURCE" != "remote" ]]; then
node - "$NEXT_BUILD_NUMBER" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const next = process.argv[2];
const appConfigPath = path.resolve(process.cwd(), 'app.config.ts');
let source = fs.readFileSync(appConfigPath, 'utf8');

const findMatchingBrace = (text, openBraceIndex) => {
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = openBraceIndex; index < text.length; index += 1) {
    const char = text[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
};

const iosMatch = source.match(/\n(\s*)ios:\s*{/);
if (!iosMatch || iosMatch.index == null) {
  throw new Error('Could not find the ios config block in app.config.ts.');
}

const iosIndent = iosMatch[1];
const openBraceIndex = iosMatch.index + iosMatch[0].lastIndexOf('{');
const closeBraceIndex = findMatchingBrace(source, openBraceIndex);
if (closeBraceIndex < 0) {
  throw new Error('Could not find the end of the ios config block in app.config.ts.');
}

const block = source.slice(openBraceIndex + 1, closeBraceIndex);
if (/buildNumber:\s*["'][^"']*["']/.test(block)) {
  const updatedBlock = block.replace(/buildNumber:\s*["'][^"']*["']/, `buildNumber: "${next}"`);
  source = `${source.slice(0, openBraceIndex + 1)}${updatedBlock}${source.slice(closeBraceIndex)}`;
} else {
  const propertyIndent = `${iosIndent}  `;
  source = `${source.slice(0, openBraceIndex + 1)}\n${propertyIndent}buildNumber: "${next}",${block}${source.slice(closeBraceIndex)}`;
}

fs.writeFileSync(appConfigPath, source);
NODE

echo "Updated iOS build number: $CURRENT_BUILD_NUMBER -> $NEXT_BUILD_NUMBER"
fi

if [[ -z "$AUTO_SUBMIT" ]]; then
  if [[ "$PROFILE" == "production" ]]; then
    AUTO_SUBMIT=1
  else
    AUTO_SUBMIT=0
  fi
fi

if [[ "$AUTO_SUBMIT" != "0" ]]; then
  echo "Starting EAS iOS build with profile \"$PROFILE\" and App Store submission..."
else
  echo "Starting EAS iOS build with profile \"$PROFILE\"..."
fi

EAS_ARGS=(
  --yes
  "$EAS_CLI_PACKAGE"
  build
  --platform ios
  --profile "$PROFILE"
)

if [[ "$AUTO_SUBMIT" != "0" ]]; then
  EAS_ARGS+=(--auto-submit)
fi

if [[ "$NON_INTERACTIVE" != "0" ]]; then
  EAS_ARGS+=(--non-interactive)
  echo "Running EAS in non-interactive mode."
else
  echo "Running EAS in interactive mode so Apple credentials can be created or repaired if needed."
fi

npx "${EAS_ARGS[@]}"
