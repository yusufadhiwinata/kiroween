module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Must be listed last (Reanimated 4 / Worklets requirement).
  plugins: ['react-native-worklets/plugin'],
};
