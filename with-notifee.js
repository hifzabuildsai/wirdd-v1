const { withAndroidManifest } = require('@expo/config-plugins');

function withNotifee(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    if (!app.service) app.service = [];

    const already = app.service.some(
      (s) => s.$?.['android:name'] === 'io.invertase.notifee.NotifeeHeadlessService',
    );
    if (!already) {
      app.service.push({
        $: {
          'android:name': 'io.invertase.notifee.NotifeeHeadlessService',
          'android:foregroundServiceType': 'microphone',
          'android:stopWithTask': 'false',
          'android:exported': 'false',
        },
      });
    }
    return config;
  });
}

module.exports = withNotifee;
