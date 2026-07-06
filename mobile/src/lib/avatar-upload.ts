import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Platform } from "react-native";

const AVATAR_SIZE = 512;
const JPEG_QUALITY = 0.75;

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function pickProfileImage(): Promise<string | null> {
  try {
    if (Platform.OS === "android") {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Photos access needed", "Allow photo library access to upload a profile picture.");
        return null;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      quality: 1,
    });

    const asset = result.assets[0];
    if (result.canceled || !asset?.uri) {
      return null;
    }

    return prepareProfileImage(asset.uri, {
      height: asset.height,
      width: asset.width,
    });
  } catch (error) {
    Alert.alert(
      "Couldn't open photos",
      error instanceof Error ? error.message : "Please try again.",
    );
    return null;
  }
}

export async function prepareProfileImage(
  uri: string,
  dimensions?: { width?: number; height?: number },
): Promise<string> {
  let width = dimensions?.width;
  let height = dimensions?.height;

  if (!width || !height) {
    ({ width, height } = await getImageSize(uri));
  }

  const cropSize = Math.min(width, height);
  const originX = Math.floor((width - cropSize) / 2);
  const originY = Math.floor((height - cropSize) / 2);

  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [
      { crop: { originX, originY, width: cropSize, height: cropSize } },
      { resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } },
    ],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return manipulated.uri;
}
