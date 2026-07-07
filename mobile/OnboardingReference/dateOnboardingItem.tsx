import React from 'react';
import { StyleSheet, View, TextInput, Text, useWindowDimensions } from 'react-native';
import Animated, { Extrapolation, SharedValue, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { OnboardingData } from '../../data';
import { Picker } from '@react-native-picker/picker';

type Props = {
  index: number;
  x: SharedValue<number>;
  item: OnboardingData;
  gender: string;
  setGender: (value: string) => void;
  preferences: string;
  setPreference: (value: string) => void;
  bio: string;
  setBio: (value: string) => void;
  wants: string;
  setWants: (value: string) => void;
};

const RenderItem = ({
  index,
  x,
  item,
  gender,
  setGender,
  preferences,
  setPreference,
  bio,
  setBio,
  wants,
  setWants,
}: Props) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  const lottieAnimationStyle = useAnimatedStyle(() => {
    const translateYAnimation = interpolate(
      x.value,
      [
        (index - 1) * SCREEN_WIDTH,
        index * SCREEN_WIDTH,
        (index + 1) * SCREEN_WIDTH,
      ],
      [200, 50, -200],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ translateY: translateYAnimation }],
    };
  });

  const circleAnimation = useAnimatedStyle(() => {
    const scale = interpolate(
      x.value,
      [
        (index - 1) * SCREEN_WIDTH,
        index * SCREEN_WIDTH,
        (index + 1) * SCREEN_WIDTH,
      ],
      [1, 4, 4],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ scale }],
    };
  });

  const renderInput = () => {
    switch (index) {
      case 0:
        return (
          <View style={styles.inputContainer}>
            <Picker
              selectedValue={gender}
              onValueChange={setGender}
              dropdownIconColor="#fafafa"
              accessibilityLabel="Select your gender"
            >
              <Picker.Item label="Select Gender" value="" color="#fafafa" />
              <Picker.Item label="Male" value="male" color="#fafafa" />
              <Picker.Item label="Female" value="female" color="#fafafa" />
              <Picker.Item label="Non-binary" value="non-binary" color="#fafafa" />
              <Picker.Item label="Prefer not to say" value="prefer-not-to-say" color="#fafafa" />
              <Picker.Item label="Other" value="other" color="#fafafa" />
            </Picker>
          </View>
        );
      case 1:
        return (
          <View style={styles.inputContainer}>
            <Picker
              selectedValue={preferences}
              onValueChange={setPreference}
              dropdownIconColor="#fafafa"
              accessibilityLabel="Select your preference"
            >
              <Picker.Item label="Interested In" value="" color="#fafafa" />
              <Picker.Item label="Male" value="male" color="#fafafa" />
              <Picker.Item label="Female" value="female" color="#fafafa" />
              <Picker.Item label="Any" value="any" color="#fafafa" />
            </Picker>
          </View>
        );
      case 2:
        return (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textArea}
              placeholder="Tell us about yourself..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor="#fafafa"
              accessibilityLabel="Your bio"
            />
          </View>
        );
      case 3:
        return (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textArea}
              placeholder="What traits are you looking for in a partner?"
              value={wants}
              onChangeText={setWants}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholderTextColor="#fafafa"
              accessibilityLabel="What you're looking for"
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.itemContainer, { width: SCREEN_WIDTH }]}>
      <View style={styles.circleContainer}>
        <Animated.View
          style={[
            {
              width: SCREEN_WIDTH,
              height: SCREEN_WIDTH,
              borderRadius: SCREEN_WIDTH / 2,
              backgroundColor: item.backgroundColor,
            },
            circleAnimation,
          ]}
        />
      </View>
      <Animated.View style={lottieAnimationStyle}>
        <LottieView
          source={item.animation}
          style={{
            width: SCREEN_WIDTH * 0.9,
            height: SCREEN_WIDTH * 0.9,
          }}
          autoPlay
          loop
        />
      </Animated.View>
      <Text style={[styles.itemText, { color: item.textColor }]}>{item.text}</Text>
      {renderInput()}
    </View>
  );
};

const styles = StyleSheet.create({
  itemContainer: {
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 120,
  },
  itemText: {
    textAlign: 'center',
    fontSize: 44,
    fontWeight: 'bold',
    marginBottom: -30,
    marginHorizontal: 20,
  },
  circleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  inputContainer: {
    width: '80%',
  },
  textArea: {
    height: 120,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    paddingTop: 10,
    marginVertical: 10,
    backgroundColor: '#000000',
    color: '#fafafa',
    textAlignVertical: 'top',
  },
});

export default RenderItem;