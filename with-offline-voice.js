const { withGradleProperties } = require('@expo/config-plugins');
module.exports = config => withGradleProperties(config, config => {
  // S10 is ARM64; x86_64 retains emulator coverage. Avoid four redundant C++
  // builds in the tester APK. Older 32-bit devices are outside this candidate.
  config.modResults = config.modResults.filter(entry => entry.key !== 'reactNativeArchitectures');
  config.modResults.push({ type: 'property', key: 'reactNativeArchitectures', value: 'arm64-v8a,x86_64' });
  return config;
});
