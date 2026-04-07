import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

function MapView({ style, children, ...props }: any) {
  return (
    <View style={[styles.map, style]} {...props}>
      <Text style={styles.text}>Map not available on web</Text>
      {children}
    </View>
  );
}

function Marker(_props: any) {
  return null;
}

const styles = StyleSheet.create({
  map: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#888',
    fontSize: 14,
  },
});

export default MapView;
export { Marker };
export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
