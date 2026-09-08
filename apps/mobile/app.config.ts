const config = {
  expo: {
    name: 'Talk to a Source', slug: 'talk-to-a-source', scheme: 'talktosource', version: '0.1.0',
    orientation: 'portrait', newArchEnabled: true,
    ios: { bundleIdentifier: 'com.talktosource.demo', infoPlist: {
      NSMicrophoneUsageDescription: 'Use your microphone to ask questions about your source.',
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    } },
    android: { package: 'com.talktosource.demo', permissions: ['RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'], usesCleartextTraffic: true },
    plugins: ['expo-document-picker', 'expo-dev-client', '@config-plugins/react-native-webrtc'],
  },
};
export default config;
