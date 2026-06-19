import React from 'react';
import { Image, StyleProp, ImageStyle } from 'react-native';

// Студийное пресс-фото брендированного седана Alif на белом фоне.
// Фон уже нормализован до #FFFFFF, поэтому фото бесшовно ложится на
// белые карточки (tariff-card, шторка) без видимой рамки. JPG —
// фотография на белом сжимается крошечно (~44KB) против PNG.
const CAR_SEDAN = require('../../assets/car-sedan.jpg');

// Соотношение сторон ассета (800×422). Высота выводится из ширины,
// чтобы фото никогда не искажалось при разных размерах.
const ASPECT = 800 / 422;

interface CarPhotoProps {
  width: number;
  style?: StyleProp<ImageStyle>;
}

export default function CarPhoto({ width, style }: CarPhotoProps): React.ReactNode {
  return (
    <Image
      source={CAR_SEDAN}
      style={[{ width, height: width / ASPECT }, style]}
      resizeMode="contain"
      accessibilityLabel="Автомобиль Alif Taxi"
    />
  );
}
