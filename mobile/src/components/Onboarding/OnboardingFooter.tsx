import { StyleSheet, View } from "react-native";
import { SharedValue } from "react-native-reanimated";

import CustomButton from "./CustomButton";
import Pagination from "./Pagination";
import { onboardingFieldTabIndex, type OnboardingData } from "../../data/onboarding";
import type { FlatList } from "react-native";
import type { AnimatedRef } from "react-native-reanimated";

type Props = {
  data: OnboardingData[];
  dataLength: number;
  flatListIndex: SharedValue<number>;
  flatListRef: AnimatedRef<FlatList<OnboardingData>>;
  isSubmitting: boolean;
  onFinish: () => void;
  onSlideChange: (index: number) => void;
  validateStep: (index: number) => string | null;
  x: SharedValue<number>;
};

export default function OnboardingFooter({
  data,
  dataLength,
  flatListIndex,
  flatListRef,
  isSubmitting,
  onFinish,
  onSlideChange,
  validateStep,
  x,
}: Props) {
  return (
    <View style={styles.footer}>
      <View style={styles.paginationWrap}>
        <Pagination data={data} x={x} />
      </View>
      <CustomButton
        dataLength={dataLength}
        flatListIndex={flatListIndex}
        flatListRef={flatListRef}
        isSubmitting={isSubmitting}
        onFinish={onFinish}
        onSlideChange={onSlideChange}
        tabIndex={onboardingFieldTabIndex.continue}
        validateStep={validateStep}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: "center",
    bottom: 20,
    flexDirection: "row",
    left: 20,
    position: "absolute",
    right: 20,
  },
  paginationWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
