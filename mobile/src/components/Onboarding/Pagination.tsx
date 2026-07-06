import { StyleSheet, View } from "react-native";
import { SharedValue } from "react-native-reanimated";

import type { OnboardingData } from "../../data/onboarding";
import Dot from "./Dot";

type Props = {
  data: OnboardingData[];
  x: SharedValue<number>;
};

export default function Pagination({ data, x }: Props) {
  return (
    <View style={styles.paginationContainer}>
      {data.map((item, index) => (
        <Dot index={index} key={item.id} x={x} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  paginationContainer: {
    alignItems: "center",
    flexDirection: "row",
    height: 40,
    justifyContent: "center",
  },
});
