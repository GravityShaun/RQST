import React from 'react';
import { FlatList, StyleSheet, Text, TouchableWithoutFeedback, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming, interpolateColor, SharedValue, AnimatedRef } from 'react-native-reanimated';
import { OnboardingData } from '../../data';
import { useAuth } from '../../provider/AuthProvider';

type Props = {
  dataLength: number;
  flatListIndex: SharedValue<number>;
  flatListRef: AnimatedRef<FlatList<OnboardingData>>;
  x: SharedValue<number>;
  phoneNumber: string;
  name: string; 
  birthday: string;
  avatarUrl: string | null;
  handleSubmit: () => void;
};

const CustomButton = ({
  flatListRef,
  flatListIndex,
  dataLength,
  x,
  phoneNumber,
  name,
  birthday,
  handleSubmit
}: Props) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const { session } = useAuth();

  const buttonAnimationStyle = useAnimatedStyle(() => {
    const isLastScreen = flatListIndex.value === dataLength - 1;
    return {
      width: isLastScreen ? withSpring(140) : withSpring(60),
      height: 60,
    };
  });

  const arrowAnimationStyle = useAnimatedStyle(() => {
    const isLastScreen = flatListIndex.value === dataLength - 1;
    return {
      width: 30,
      height: 30,
      opacity: isLastScreen ? withTiming(0) : withTiming(1),
      transform: [{ 
        translateX: isLastScreen ? withTiming(100) : withTiming(0) 
      }],
    };
  });

  const textAnimationStyle = useAnimatedStyle(() => ({
    opacity: flatListIndex.value === dataLength - 1 ? withTiming(1) : withTiming(0),
    transform: [{ translateX: flatListIndex.value === dataLength - 1 ? withTiming(0) : withTiming(-100) }],
  }));

  const animatedColor = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(x.value, [0, SCREEN_WIDTH, 2 * SCREEN_WIDTH], ['#000', '#000', '#000']),
  }));

  const validateInputs = () => {
    const errors: string[] = [];

    if (flatListIndex.value === dataLength - 1) {
      if (!phoneNumber || !name || !birthday) {
        errors.push('Please fill out all required fields.');
        return errors;
      }

      const cleanedNumber = phoneNumber.replace(/\D/g, '');
      if (cleanedNumber.length !== 10) {
        errors.push('Please enter a valid phone number.');
      }

      if (!name.trim()) {
        errors.push('Name is required.');
      }

      const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
      if (!dateRegex.test(birthday)) {
        errors.push('Please enter a valid birthday (MM/DD/YYYY).');
      }
    }

    return errors;
  };

  const handlePress = async () => {
    if (flatListIndex.value < dataLength - 1) {
      flatListRef.current?.scrollToIndex({ index: flatListIndex.value + 1 });
    } else {
      const errors = validateInputs();
      if (errors.length > 0) {
        alert(errors.join('\n'));
        return;
      }
      handleSubmit();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={handlePress}>
        <Animated.View style={[styles.button, buttonAnimationStyle, animatedColor]}>
          <Animated.Text style={[styles.textButton, textAnimationStyle]}>
            {flatListIndex.value === dataLength - 1 ? 'Continue' : 'Next'}
          </Animated.Text>
          <Animated.View style={[styles.arrow, arrowAnimationStyle]}>
            <Animated.Image 
              source={require('../../assets/images/ArrowIcon.png')}
              style={{ width: 40, height: 40 }}
            />
          </Animated.View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
};

export default CustomButton;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    alignItems: 'flex-end',
    width: '100%',
  },
  button: {
    backgroundColor: '#1e2169',
    padding: 10,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,  
    borderColor: '#323232', 
  },
  arrow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: {
    color: 'white',
    fontSize: 16,
    position: 'absolute',
  },
});
