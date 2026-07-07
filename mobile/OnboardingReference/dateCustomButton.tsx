import React from 'react';
import { FlatList, StyleSheet, TouchableWithoutFeedback, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming, interpolateColor, SharedValue, AnimatedRef } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useUserStore } from '../../store';
import { OnboardingData } from '../../data';
import { useAuth } from '../../provider/AuthProvider';
import config from '@lib/constants';

const { profileUrl: API_URL } = config;

type Props = {
  dataLength: number;
  flatListIndex: SharedValue<number>;
  flatListRef: AnimatedRef<FlatList<OnboardingData>>;
  x: SharedValue<number>;
  gender: string;
  preferences: string;
  bio: string;
  wants: string;
  setGender: (value: string) => void;
  setPreference: (value: string) => void;
  setBio: (value: string) => void;
  setWants: (value: string) => void;
};

const DateCustomButton: React.FC<Props> = ({
  flatListRef,
  flatListIndex,
  dataLength,
  x,
  gender,
  preferences,
  bio,
  wants,
}) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const { setIsFirstLogin } = useUserStore();
  const { session, user } = useAuth();

  const buttonAnimationStyle = useAnimatedStyle(() => ({
    width: flatListIndex.value === dataLength - 1 ? withSpring(140) : withSpring(60),
    height: 60,
  }));

  const arrowAnimationStyle = useAnimatedStyle(() => ({
    opacity: flatListIndex.value === dataLength - 1 ? withTiming(0) : withTiming(1),
    transform: [{ translateX: flatListIndex.value === dataLength - 1 ? withTiming(100) : withTiming(0) }],
  }));

  const textAnimationStyle = useAnimatedStyle(() => ({
    opacity: flatListIndex.value === dataLength - 1 ? withTiming(1) : withTiming(0),
    transform: [{ translateX: flatListIndex.value === dataLength - 1 ? withTiming(0) : withTiming(-100) }],
  }));

  const animatedColor = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(x.value, [0, SCREEN_WIDTH, 2 * SCREEN_WIDTH], ['#000', '#000', '#000']),
  }));

  const validateInputs = () => {
    const errors = [];
    if (flatListIndex.value === dataLength - 1) {
      if (!gender) errors.push('Gender is required.');
      if (!preferences) errors.push('Preference is required.');
      if (!bio) errors.push('Bio is required.');
      if (!wants) errors.push('Wants is required.');
    }
    return errors;
  };

  const handlePress = async () => {
    const errors = validateInputs();
    if (errors.length) {
      alert(errors.join('\n'));
      return;
    }

    if (flatListIndex.value < dataLength - 1) {
      flatListRef.current?.scrollToIndex({ index: flatListIndex.value + 1 });
      return;
    }

    if (!session?.access_token || !user?.id) {
      alert('Authentication required');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/${user.id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          gender,
          preferences,
          bio,
          wants,
          onboard2: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      setIsFirstLogin(false);
      router.replace('/home');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={handlePress}>
        <Animated.View style={[styles.button, buttonAnimationStyle, animatedColor]}>
          <Animated.Text style={[styles.textButton, textAnimationStyle]}>
            {flatListIndex.value === dataLength - 1 ? 'Go Back!' : 'Finish!'}
          </Animated.Text>
          <Animated.Image
            source={require('../../assets/images/ArrowIcon.png')}
            style={[styles.arrow, arrowAnimationStyle]}
          />
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
};

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
    position: 'absolute',
  },
  textButton: {
    color: 'white',
    fontSize: 16,
    position: 'absolute',
  },
});

export default DateCustomButton;
