import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useProfileStore } from '@/stores/profileStore';
import { getCurrentUserId, fetchIsPro } from '@/services/supabase';

const PADDLE_PRODUCT_ID = process.env.EXPO_PUBLIC_PADDLE_PRODUCT_ID ?? '';

const PRO_FEATURES = [
  'Pinned notification on locked screen',
  'Multiple phrases & custom keywords',
  'Annual heatmap & time ring',
  'Cloud backup & CSV export',
] as const;

export default function SettingsScreen() {
  const { isPro, setIsPro } = useProfileStore();

  async function handleUnlockPro() {
    const userId = await getCurrentUserId();
    if (!userId) return;

    // Pass userId as custom_data so the webhook knows who to unlock
    const checkoutUrl =
      `https://buy.paddle.com/product/${PADDLE_PRODUCT_ID}` +
      `?custom_data=${encodeURIComponent(JSON.stringify({ user_id: userId }))}`;

    const result = await WebBrowser.openAuthSessionAsync(
      checkoutUrl,
      'wirdd://payment-success',
    );

    // Deep link fired — verify against Supabase (webhook may have already set it)
    if (result.type === 'success' || result.type === 'dismiss') {
      const pro = await fetchIsPro(userId);
      if (pro) setIsPro(true);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Plan card */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>YOUR PLAN</Text>

        <View style={styles.planRow}>
          <View style={[styles.planBadge, isPro ? styles.planBadgePro : styles.planBadgeFree]}>
            <Text style={[styles.planBadgeText, isPro ? styles.planBadgeTextPro : styles.planBadgeTextFree]}>
              {isPro ? 'Pro' : 'Free'}
            </Text>
          </View>
          {isPro && (
            <Text style={styles.proActiveLabel}>All features unlocked</Text>
          )}
        </View>

        {!isPro && (
          <Pressable
            style={({ pressed }) => [styles.unlockButton, pressed && styles.unlockButtonPressed]}
            onPress={handleUnlockPro}
          >
            <Text style={styles.unlockButtonText}>Unlock Wirdd Pro</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.background} />
          </Pressable>
        )}
      </View>

      {/* PRO features list (only shown when free) */}
      {!isPro && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>WHAT YOU GET</Text>
          <View style={styles.featureList}>
            {PRO_FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Text style={styles.featureBullet}>✦</Text>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
            <Text style={styles.priceNote}>$14.99 · one-time · no subscription</Text>
          </View>
        </View>
      )}

      {/* App info */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>APP</Text>
        <View style={styles.infoList}>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Platform</Text>
            <Text style={styles.infoValue}>Android</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Bundle ID</Text>
            <Text style={styles.infoValue}>app.wirdd.android</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 20,
  },
  sectionLabel: {
    fontFamily: Fonts.ui,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 16,
  },

  // ── Plan ──────────────────────────────────────────────────────────────────
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  planBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  planBadgeFree: {
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  planBadgePro: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSubtle,
  },
  planBadgeText: {
    fontFamily: Fonts.uiMedium,
    fontSize: 13,
  },
  planBadgeTextFree: {
    color: Colors.textSecondary,
  },
  planBadgeTextPro: {
    color: Colors.gold,
  },
  proActiveLabel: {
    fontFamily: Fonts.ui,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  unlockButtonPressed: {
    opacity: 0.8,
  },
  unlockButtonText: {
    fontFamily: Fonts.uiMedium,
    fontSize: 15,
    color: Colors.background,
  },

  // ── Features ──────────────────────────────────────────────────────────────
  featureList: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  featureBullet: {
    fontFamily: Fonts.ui,
    fontSize: 11,
    color: Colors.gold,
    lineHeight: 20,
  },
  featureText: {
    flex: 1,
    fontFamily: Fonts.ui,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  priceNote: {
    fontFamily: Fonts.ui,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },

  // ── App info ──────────────────────────────────────────────────────────────
  infoList: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoKey: {
    fontFamily: Fonts.ui,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontFamily: Fonts.uiMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
});
