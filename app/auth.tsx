import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { signIn, signUp } from '@/services/supabase';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';

type Tab = 'signup' | 'signin';

export default function AuthScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (tab === 'signup') {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      router.replace('/permission/index');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    router.replace('/permission/index');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>وِرد</Text>
        <Text style={styles.subtitle}>Sync your dhikr across devices</Text>

        {/* Tab toggle */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, tab === 'signup' && styles.tabActive]}
            onPress={() => { setTab('signup'); setError(''); }}
          >
            <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>
              Sign up
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'signin' && styles.tabActive]}
            onPress={() => { setTab('signin'); setError(''); }}
          >
            <Text style={[styles.tabText, tab === 'signin' && styles.tabTextActive]}>
              Sign in
            </Text>
          </Pressable>
        </View>

        {/* Inputs */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <Text style={styles.submitText}>
              {tab === 'signup' ? 'Create account' : 'Sign in'}
            </Text>
          )}
        </Pressable>

        <TouchableOpacity style={styles.skipLink} onPress={handleSkip} activeOpacity={0.6}>
          <Text style={styles.skipLinkText}>Continue without account</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  logo: {
    fontFamily: Fonts.arabic,
    fontSize: 56,
    color: Colors.gold,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.ui,
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    width: '100%',
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.surfaceElevated,
  },
  tabText: {
    fontFamily: Fonts.ui,
    fontSize: 14,
    color: Colors.textMuted,
  },
  tabTextActive: {
    fontFamily: Fonts.uiMedium,
    color: Colors.textPrimary,
  },

  // ── Inputs ────────────────────────────────────────────────────────────────
  input: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: Fonts.ui,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  error: {
    fontFamily: Fonts.ui,
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  submitBtn: {
    width: '100%',
    backgroundColor: Colors.gold,
    paddingVertical: 15,
    borderRadius: 32,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontFamily: Fonts.uiMedium,
    fontSize: 16,
    color: Colors.background,
  },
  skipLink: {
    marginTop: 16,
    paddingVertical: 8,
  },
  skipLinkText: {
    fontFamily: Fonts.ui,
    fontSize: 14,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
