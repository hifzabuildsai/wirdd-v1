import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: {
          fontFamily: Fonts.ui,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Session',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="mic-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="bar-chart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="qalb"
        options={{
          title: 'Qalb',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="heart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
