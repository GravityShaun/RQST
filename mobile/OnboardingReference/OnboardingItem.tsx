import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Text, useWindowDimensions } from 'react-native';
import Animated, { Extrapolation, SharedValue, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { OnboardingData } from '../../data';
import Avatar from '../AvatarUploader';

interface Props {
  index: number;
  x: SharedValue<number>;
  item: OnboardingData;
  name: string;
  setName: (value: string) => void;
  birthday: string;
  setBirthday: (value: string) => void;
  phoneNumber: string;
  setPhoneNumber: (value: string) => void;
  countryCode: string;
  setCountryCode: (value: string) => void;
  user_id: string;
  onUpload: (filePath: string) => void;
}

const RenderItem: React.FC<Props> = ({
  index,
  x,
  item,
  name,
  setName,
  birthday,
  setBirthday,
  phoneNumber,
  setPhoneNumber,
  countryCode,
  setCountryCode,
  user_id,
  onUpload,
}) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [birthdayError, setBirthdayError] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);

  const lottieAnimationStyle = useAnimatedStyle(() => {
    const translateYAnimation = interpolate(
      x.value,
      [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH],
      [200, 50, -200],
      Extrapolation.CLAMP,
    );

    return { transform: [{ translateY: translateYAnimation }] };
  });

  const circleAnimation = useAnimatedStyle(() => {
    const scale = interpolate(
      x.value,
      [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH],
      [1, 4, 4],
      Extrapolation.CLAMP,
    );

    return { transform: [{ scale }] };
  });

  const handlePhoneNumberChange = (value: string) => {
    const cleanedNumber = value.replace(/\D/g, '');
    
    let formattedNumber = cleanedNumber;
    if (cleanedNumber.length > 0) {
      formattedNumber = cleanedNumber.replace(/(\d{1,3})(\d{1,3})?(\d{1,4})?/, (_, p1, p2, p3) => {
        let formatted = p1;
        if (p2) formatted += '-' + p2;
        if (p3) formatted += '-' + p3;
        return formatted;
      });
    }
    
    setPhoneNumber(formattedNumber);
    validatePhoneNumber(cleanedNumber);
  };

  const handleCountryCodeChange = (value: string) => {
    const cleanedCode = value.replace(/\D/g, '');
    if (cleanedCode.length <= 3) {
      setCountryCode(cleanedCode);
      const cleanedNumber = phoneNumber.replace(/\D/g, '');
      validatePhoneNumber(cleanedNumber);
    }
  };

  const validatePhoneNumber = (cleanedNumber: string) => {
    if (!countryCode) {
      setPhoneError('Country code is required');
      return;
    }

    if (countryCode === '1') {
      if (cleanedNumber.length === 0) {
        setPhoneError(null);
      } else if (cleanedNumber.length < 10) {
        setPhoneError('Please enter complete phone number');
      } else if (cleanedNumber.length === 10) {
        setPhoneError(null);
      } else {
        setPhoneError('Phone number is too long');
      }
    } else {
      if (cleanedNumber.length === 0) {
        setPhoneError(null);
      } else if (cleanedNumber.length < 5) {
        setPhoneError('Phone number is too short');
      } else if (cleanedNumber.length > 12) {
        setPhoneError('Phone number is too long');
      } else {
        setPhoneError(null);
      }
    }
  };

  const formatDate = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 8);
    const match = cleaned.match(/^(\d{0,2})(\d{0,2})(\d{0,4})$/);
    return match ? `${match[1]}/${match[2]}${match[3] ? '/' + match[3] : ''}` : value;
  };

  const isValidDate = (dateString: string) => /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/.test(dateString);

  const calculateAge = (dateString: string) => {
    const [month, day, year] = dateString.split('/').map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    return today.getFullYear() - birthDate.getFullYear() - (today < new Date(today.getFullYear(), month - 1, day) ? 1 : 0);
  };

  const handleBirthdayChange = (value: string) => {
    const formatted = formatDate(value);
    setBirthday(formatted);
    if (!isValidDate(formatted)) {
      setBirthdayError('Invalid Date. Format should be MM/DD/YYYY.');
      setAgeError(null);
    } else {
      const age = calculateAge(formatted);
      setBirthdayError(null);
      setAgeError(age < 18 || age > 99 ? 'Age must be between 18 and 99.' : null);
    }
  };

  const renderInput = () => {
    switch (index) {
      case 1: // Phone number
        return (
          <View style={styles.inputContainer}>
            <View style={styles.phoneContainer}>
              <View style={styles.countryCodeContainer}>
                <Text style={styles.plusSign}>+</Text>
                <TextInput
                  style={styles.countryCodeInput}
                  placeholder="1"
                  value={countryCode}
                  onChangeText={handleCountryCodeChange}
                  keyboardType="phone-pad"
                  placeholderTextColor="#fafafa"
                  maxLength={3}
                />
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="(555) 555-5555"
                value={phoneNumber}
                onChangeText={handlePhoneNumberChange}
                keyboardType="phone-pad"
                placeholderTextColor="#fafafa"
              />
            </View>
            {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
          </View>
        );
      case 2: // Name
        return (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#fafafa"
            />
          </View>
        );
      case 3: // Birthday
        return (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              value={birthday}
              onChangeText={handleBirthdayChange}
              keyboardType="numeric"
              placeholderTextColor="#fafafa"
            />
            {birthdayError && <Text style={styles.errorText}>{birthdayError}</Text>}
            {ageError && <Text style={styles.errorText}>{ageError}</Text>}
          </View>
        );
      case 4: // Profile Picture
        return (
          <View style={styles.inputContainer}>
            <View style={styles.avatarContainer}>
              <Avatar
                size={130}
                url={null}
                onUpload={onUpload}
                user_id={user_id}
                isEditable={true}
              />
              <Text style={styles.avatarHelpText}>
                Tap to upload your profile picture
              </Text>
            </View>
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
      <View style={styles.animationContainer}>
      <Animated.View style={lottieAnimationStyle}>
        <LottieView
          source={item.animation}
          style={{
            width: SCREEN_WIDTH * 0.85,
            height: SCREEN_WIDTH * 0.85,
          }}
          autoPlay
          loop
        />
      </Animated.View>
      </View>
      <Text style={[styles.itemText, { color: item.textColor }]}>{item.text}</Text>
      {renderInput()}
    </View>
  );
};

export default RenderItem;

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
  input: {
    height: 60,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    marginVertical: 10,
    backgroundColor: '#000',
    color: '#fafafa',
  },
  errorText: {
    color: 'red',
    marginTop: 5,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  countryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    marginRight: 10,
    paddingHorizontal: 8,
    height: 60,
  },
  plusSign: {
    color: '#fafafa',
    fontSize: 18,
    marginRight: 2,
  },
  countryCodeInput: {
    color: '#fafafa',
    width: 35,
    fontSize: 16,
    textAlign: 'center',
  },
  phoneInput: {
    flex: 1,
    height: 60,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    backgroundColor: '#000',
    color: '#fafafa',
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 30,
    width: '100%',
  },
  avatarHelpText: {
    color: '#fafafa',
    marginTop: 15,
    fontSize: 16,
    opacity: 0.8,
  },
  animationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
    marginTop: -30, 
  },
});