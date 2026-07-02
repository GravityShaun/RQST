const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const packageRoots = [
  path.join(repoRoot, 'mobile', 'node_modules', 'react-native-maps'),
  path.join(repoRoot, 'node_modules', 'react-native-maps'),
];

const guardPatches = [
  {
    relativePath: path.join('ios', 'AirMaps', 'RNMapsMapView.mm'),
    header: '#ifdef RCT_NEW_ARCH_ENABLED',
    footer: '#endif',
  },
  {
    relativePath: path.join('ios', 'AirMaps', 'RNMapsMarkerView.mm'),
    header: '#ifdef RCT_NEW_ARCH_ENABLED',
    footer: '#endif',
  },
  {
    relativePath: path.join('ios', 'AirGoogleMaps', 'RNMapsGoogleMapView.mm'),
    header: '#ifdef RCT_NEW_ARCH_ENABLED',
    footer: '#endif',
  },
  {
    relativePath: path.join('ios', 'AirGoogleMaps', 'RNMapsGooglePolygonView.mm'),
    header: '#ifdef RCT_NEW_ARCH_ENABLED',
    footer: '#endif',
  },
  {
    relativePath: path.join('ios', 'AirMaps', 'FabricPlaceholders', 'PlaceHolderGoogleMapView.mm'),
    header: '#ifdef RCT_NEW_ARCH_ENABLED',
    footer: '#endif',
  },
  {
    relativePath: path.join('ios', 'AirMaps', 'FabricPlaceholders', 'PlaceHolderPolygonView.mm'),
    header: '#ifdef RCT_NEW_ARCH_ENABLED',
    footer: '#endif',
  },
];

const sourcePatches = [
  {
    relativePath: path.join('src', 'MapViewNativeComponent.ts'),
    replacements: [
      [
        "import {codegenNativeCommands} from 'react-native';",
        "import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';",
      ],
    ],
  },
  {
    relativePath: path.join('src', 'MapView.tsx'),
    replacements: [
      [
        "import createFabricMap, {type FabricMapHandle} from './createFabricMap';\n\nconst FabricMap = createFabricMap(FabricMapView, FabricCommands);",
        "import createFabricMap, {type FabricMapHandle} from './createFabricMap';\n\nconst mapsRuntime = globalThis as {\n  __turboModuleProxy?: unknown;\n  nativeFabricUIManager?: unknown;\n};\nconst canUseFabricMaps =\n  mapsRuntime.nativeFabricUIManager != null &&\n  mapsRuntime.__turboModuleProxy != null;\n\nconst FabricMap = createFabricMap(FabricMapView, FabricCommands);",
      ],
      [
        "    const childrenNodes = this.state.isReady ? children : null;\n\n    if (provider === 'google' && Platform.OS === 'ios') {",
        "    const childrenNodes = this.state.isReady ? children : null;\n    const AIRMap = provider === 'google' ? airMaps.google : airMaps.default;\n\n    if (!canUseFabricMaps) {\n      return (\n        <ProviderContext.Provider value={this.props.provider}>\n          <AIRMap {...props} ref={this.map}>\n            {childrenNodes}\n          </AIRMap>\n        </ProviderContext.Provider>\n      );\n    }\n\n    if (provider === 'google' && Platform.OS === 'ios') {",
      ],
    ],
  },
  {
    relativePath: path.join('src', 'MapMarkerNativeComponent.ts'),
    replacements: [
      [
        "import {codegenNativeCommands} from 'react-native';",
        "import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';",
      ],
    ],
  },
  {
    relativePath: path.join('src', 'MapMarker.tsx'),
    replacements: [
      [
        "import {fixImageProp} from './fixImageProp';\n\ntype AppleMarkerVisibility = 'hidden' | 'adaptive' | 'visible';",
        "import {fixImageProp} from './fixImageProp';\n\nconst markerRuntime = globalThis as {\n  __turboModuleProxy?: unknown;\n  nativeFabricUIManager?: unknown;\n};\nconst canUseFabricMarker =\n  markerRuntime.nativeFabricUIManager != null &&\n  markerRuntime.__turboModuleProxy != null;\n\ntype AppleMarkerVisibility = 'hidden' | 'adaptive' | 'visible';",
      ],
      [
        "      this.fabricMarker = !(\n        Platform.OS === 'ios' && provider === PROVIDER_GOOGLE\n      );",
        "      this.fabricMarker =\n        canUseFabricMarker &&\n        !(Platform.OS === 'ios' && provider === PROVIDER_GOOGLE);",
      ],
    ],
  },
  {
    relativePath: path.join('src', 'decorateMapComponent.ts'),
    replacements: [
      [
        "import FabricOverlay from './specs/NativeComponentOverlay';\n\nexport const SUPPORTED: ImplementationStatus = 'SUPPORTED';",
        "import FabricOverlay from './specs/NativeComponentOverlay';\n\nconst componentRuntime = globalThis as {\n  __turboModuleProxy?: unknown;\n  nativeFabricUIManager?: unknown;\n};\nconst canUseFabricComponents =\n  componentRuntime.nativeFabricUIManager != null &&\n  componentRuntime.__turboModuleProxy != null;\n\nexport const SUPPORTED: ImplementationStatus = 'SUPPORTED';",
      ],
      [
        "      if (\n        componentName === 'Marker' &&",
        "      if (\n        canUseFabricComponents &&\n        componentName === 'Marker' &&",
      ],
      [
        "      if (\n        componentName === 'Polygon' &&",
        "      if (\n        canUseFabricComponents &&\n        componentName === 'Polygon' &&",
      ],
      [
        "      if (Platform.OS === 'android') {",
        "      if (canUseFabricComponents && Platform.OS === 'android') {",
      ],
    ],
  },
  {
    relativePath: path.join('src', 'specs', 'NativeComponentMapView.ts'),
    replacements: [
      [
        "import {codegenNativeComponent, codegenNativeCommands} from 'react-native';",
        "import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';\nimport codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';",
      ],
    ],
  },
  {
    relativePath: path.join('src', 'specs', 'NativeComponentMarker.ts'),
    replacements: [
      [
        "import {codegenNativeComponent, codegenNativeCommands} from 'react-native';",
        "import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';\nimport codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';",
      ],
    ],
  },
  {
    relativePath: path.join('src', 'specs', 'NativeComponentGoogleMapView.ts'),
    replacements: [
      [
        "import {codegenNativeComponent, codegenNativeCommands} from 'react-native';",
        "import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';\nimport codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';",
      ],
    ],
  },
  {
    relativePath: path.join('src', 'specs', 'NativeAirMapsModule.ts'),
    replacements: [[
      "export default TurboModuleRegistry.getEnforcing<Spec>('RNMapsAirModule');",
      "export default TurboModuleRegistry.get<Spec>('RNMapsAirModule');",
    ]],
  },
  ...[
    'NativeComponentCallout.ts',
    'NativeComponentCircle.ts',
    'NativeComponentGooglePolygon.ts',
    'NativeComponentOverlay.ts',
    'NativeComponentPolyline.ts',
    'NativeComponentUrlTile.ts',
    'NativeComponentWMSTile.ts',
  ].map(name => ({
    relativePath: path.join('src', 'specs', name),
    replacements: [[
      "import {codegenNativeComponent} from 'react-native';",
      "import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';",
    ]],
  })),
];

function wrapWithGuard(source, header, footer) {
  if (source.includes(header)) {
    return source;
  }

  const lines = source.split('\n');
  let insertAt = 0;

  while (insertAt < lines.length) {
    const trimmed = lines[insertAt].trim();
    if (
      trimmed.startsWith('//') ||
      trimmed === '' ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('*/')
    ) {
      insertAt += 1;
      continue;
    }
    break;
  }

  lines.splice(insertAt, 0, header, '');
  lines.push('', footer);
  return lines.join('\n');
}

let updated = 0;

for (const packageRoot of packageRoots) {
  if (!fs.existsSync(packageRoot)) {
    continue;
  }

  for (const patch of guardPatches) {
    const filePath = path.join(packageRoot, patch.relativePath);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const original = fs.readFileSync(filePath, 'utf8');
    const next = wrapWithGuard(original, patch.header, patch.footer);

    if (next !== original) {
      fs.writeFileSync(filePath, next);
      updated += 1;
      console.log(`Patched ${path.relative(repoRoot, filePath)}`);
    }
  }

  for (const patch of sourcePatches) {
    const filePath = path.join(packageRoot, patch.relativePath);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const original = fs.readFileSync(filePath, 'utf8');
    let next = original;
    for (const [from, to] of patch.replacements) {
      next = next.split(from).join(to);
    }

    if (next !== original) {
      fs.writeFileSync(filePath, next);
      updated += 1;
      console.log(`Patched ${path.relative(repoRoot, filePath)}`);
    }
  }
}

if (updated === 0) {
  console.log('react-native-maps native patch already applied or package not installed');
}
