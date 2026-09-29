const { withAndroidManifest } = require('@expo/config-plugins');

function withNotifee(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    if (!app.service) app.service = [];

    const already = app.service.some(
      (s) => s.$?.['android:name'] === 'app.notifee.core.ForegroundService',
    );
    if (!already) {
      app.service.push({
        $: {
          'android:name': 'app.notifee.core.ForegroundService',
          'android:foregroundServiceType': 'microphone',
        },
      });
    }
    return config;
  });
}

module.exports = withNotifee;
