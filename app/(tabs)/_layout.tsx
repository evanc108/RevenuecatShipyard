import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { AddModal } from '@/components/ui/AddModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Icon } from '@/components/ui/Icon';
import { Colors } from '@/constants/theme';
import { AddModalProvider, useAddModal } from '@/context/AddModalContext';

function AddTabButton(props: BottomTabBarButtonProps) {
  const { openModal } = useAddModal();

  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        openModal();
        props.onPressIn?.(ev);
      }}
      onPress={undefined}
    />
  );
}

function TabLayoutContent() {
  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: Colors.text.tertiary,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            paddingTop: 12,
            height: 88,
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Cookbook',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="book.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="safari.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: '',
            tabBarIcon: () => (
              <View style={styles.addButton}>
                <Icon name="plus" size={22} color={Colors.text.inverse} strokeWidth={2.5} />
              </View>
            ),
            tabBarButton: AddTabButton,
          }}
        />
        <Tabs.Screen
          name="meal-plan"
          options={{
            title: 'Pantry',
            tabBarIcon: ({ color }) => <Icon name="utensils" size={26} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
          }}
        />
      </Tabs>
      <AddModal />
    </>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 52,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function TabLayout() {
  return (
    <AddModalProvider>
      <TabLayoutContent />
    </AddModalProvider>
  );
}
