import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { router } from "expo-router";

import { onboardingSlides } from "../../data/onboarding";
import { pickProfileImage } from "../../lib/avatar-upload";
import { uploadUserAvatar } from "../../lib/auth-api";
import { premiumTheme } from "../premium-ui";
import { useAuthStore } from "../../store/auth";
import OnboardingFooter from "./OnboardingFooter";
import OnboardingItem from "./OnboardingItem";

type Props = {
  email: string;
};

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<typeof onboardingSlides[number]>);

export default function OnboardingScreen({ email }: Props) {
  const signUp = useAuthStore((state) => state.signUp);
  const setUser = useAuthStore((state) => state.setUser);
  const { width: screenWidth } = useWindowDimensions();
  const flatListRef = useAnimatedRef<FlatList<(typeof onboardingSlides)[number]>>();
  const x = useSharedValue(0);
  const flatListIndex = useSharedValue(0);

  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingAvatar, setIsPickingAvatar] = useState(false);

  const updateCurrentIndex = useCallback(
    (offsetX: number) => {
      setCurrentIndex(Math.round(offsetX / screenWidth));
    },
    [screenWidth],
  );

  const scrollToSlide = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      flatListRef.current?.scrollToIndex({ animated: true, index });
    },
    [flatListRef],
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      x.value = event.contentOffset.x;
      flatListIndex.value = Math.round(event.contentOffset.x / screenWidth);
    },
  });

  const handlePickAvatar = useCallback(async () => {
    if (isPickingAvatar) {
      return;
    }

    setIsPickingAvatar(true);
    try {
      const uri = await pickProfileImage();
      if (uri) {
        setAvatarUri(uri);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not select a photo. Please try again.");
    } finally {
      setIsPickingAvatar(false);
    }
  }, [isPickingAvatar]);

  const validateStep = useCallback(
    (index: number) => {
      setDisplayNameError(null);
      setPasswordError(null);
      setConfirmPasswordError(null);

      const slideId = onboardingSlides[index]?.id;

      if (slideId === "name") {
        const trimmedName = displayName.trim();
        if (trimmedName.length < 2) {
          const message = "Display name must be at least 2 characters.";
          setDisplayNameError(message);
          return message;
        }
        if (trimmedName.length > 120) {
          const message = "Display name must be 120 characters or fewer.";
          setDisplayNameError(message);
          return message;
        }
      }

      if (slideId === "password") {
        if (password.length < 8) {
          const message = "Password must be at least 8 characters.";
          setPasswordError(message);
          return message;
        }
        if (password.length > 128) {
          const message = "Password must be 128 characters or fewer.";
          setPasswordError(message);
          return message;
        }
        if (password !== confirmPassword) {
          const message = "Passwords do not match.";
          setConfirmPasswordError(message);
          return message;
        }
      }

      return null;
    },
    [confirmPassword, displayName, password],
  );

  const handleFinish = useCallback(async () => {
    const nameError = validateStep(onboardingSlides.findIndex((slide) => slide.id === "name"));
    const passwordStepError = validateStep(onboardingSlides.findIndex((slide) => slide.id === "password"));
    if (nameError || passwordStepError) {
      alert(nameError ?? passwordStepError);
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp(email, password, displayName.trim());

      if (avatarUri) {
        const accessToken = useAuthStore.getState().accessToken;
        if (accessToken) {
          const updatedUser = await uploadUserAvatar(accessToken, avatarUri);
          setUser(updatedUser);
        }
      }

      router.replace("/(tabs)/home");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not create your account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [avatarUri, displayName, email, password, setUser, signUp, validateStep]);

  return (
    <View style={styles.screen}>
      {isSubmitting || isPickingAvatar ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={premiumTheme.colors.coral} size="large" />
        </View>
      ) : null}

      <AnimatedFlatList
        ref={flatListRef}
        data={onboardingSlides}
        horizontal
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={(event) => updateCurrentIndex(event.nativeEvent.contentOffset.x)}
        onScroll={onScroll}
        onScrollEndDrag={(event) => updateCurrentIndex(event.nativeEvent.contentOffset.x)}
        onScrollToIndexFailed={({ index }) => {
          flatListRef.current?.scrollToOffset({
            animated: true,
            offset: index * screenWidth,
          });
        }}
        pagingEnabled
        renderItem={({ item, index }) => (
          <OnboardingItem
            avatarUri={avatarUri}
            confirmPassword={confirmPassword}
            confirmPasswordError={confirmPasswordError}
            displayName={displayName}
            displayNameError={displayNameError}
            index={index}
            item={item}
            onFieldFocus={scrollToSlide}
            onPickAvatar={() => void handlePickAvatar()}
            password={password}
            passwordError={passwordError}
            setConfirmPassword={setConfirmPassword}
            setDisplayName={setDisplayName}
            setPassword={setPassword}
            x={x}
          />
        )}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
      />

      <OnboardingFooter
        data={onboardingSlides}
        dataLength={onboardingSlides.length}
        flatListIndex={flatListIndex}
        flatListRef={flatListRef}
        isSubmitting={isSubmitting}
        onFinish={() => void handleFinish()}
        onSlideChange={setCurrentIndex}
        validateStep={validateStep}
        x={x}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: premiumTheme.colors.background,
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(30,23,23,0.24)",
    justifyContent: "center",
    zIndex: 2,
  },
});
