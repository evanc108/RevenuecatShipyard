import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { RecipePickerSheet } from '@/components/features/pantry/RecipePickerSheet';
import { HapticTab } from '@/components/haptic-tab';
import { FloatingMealPlanProgress } from '@/components/ui/FloatingMealPlanProgress';
import { FloatingUploadProgress } from '@/components/ui/FloatingUploadProgress';
import { Icon } from '@/components/ui/Icon';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAddModal } from '@/context/AddModalContext';
import { RecipePickerProvider } from '@/context/RecipePickerContext';

// --- Playful brush stroke behind active tab icon ---

function TabIconWrapper({
  children,
  focused,
}: {
  children: React.ReactNode;
  focused: boolean;
}): React.ReactElement {
  return (
    <View style={styles.iconWrapper}>
      {focused ? <View style={styles.brushStroke} /> : null}
      {children}
    </View>
  );
}

// --- Add (center) tab button ---

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
            paddingHorizontal: 12,
            height: 88,
            backgroundColor: Colors.background.primary,
            borderTopWidth: 1,
            borderTopColor: 'rgba(0,0,0,0.05)',
            overflow: 'visible',
            // Upward shadow for elevated / floating look
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Cookbook',
            tabBarIcon: ({ color, focused }) => (
              <TabIconWrapper focused={focused}>
                <IconSymbol size={26} name="book.fill" color={color} />
              </TabIconWrapper>
            ),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ color, focused }) => (
              <TabIconWrapper focused={focused}>
                <IconSymbol size={26} name="safari.fill" color={color} />
              </TabIconWrapper>
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: '',
            tabBarItemStyle: { overflow: 'visible' },
            tabBarIcon: () => (
              <View style={styles.addButton}>
                <Icon name="plus" size={24} color={Colors.text.inverse} strokeWidth={2.5} />
              </View>
            ),
            tabBarButton: AddTabButton,
          }}
        />
        <Tabs.Screen
          name="meal-plan"
          options={{
            title: 'Pantry',
            tabBarIcon: ({ color, focused }) => (
              <TabIconWrapper focused={focused}>
                <Icon name="utensils" size={26} color={color} />
              </TabIconWrapper>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <TabIconWrapper focused={focused}>
                <IconSymbol size={26} name="person.fill" color={color} />
              </TabIconWrapper>
            ),
          }}
        />
      </Tabs>
      <RecipePickerSheet />
      <FloatingUploadProgress />
      <FloatingMealPlanProgress />
    </>
  );
}

const styles = StyleSheet.create({
  // Brush stroke wrapper for tab icons
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 36,
  },
  brushStroke: {
    position: 'absolute',
    width: 44,
    height: 28,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 16,
    backgroundColor: Colors.accent,
    opacity: 0.25,
    transform: [{ rotate: '-5deg' }, { scaleX: 1.05 }],
  },
  // Elevated circular add button
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    top: -16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
});

export default function TabLayout() {
  return (
    <RecipePickerProvider>
      <TabLayoutContent />
    </RecipePickerProvider>
  );
}
