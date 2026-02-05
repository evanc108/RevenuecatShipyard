# RevenueCat Shipyard

A recipe discovery and meal planning app built with React Native and Expo.

## Features

- **Recipe Import** - Import recipes from URLs including TikTok, Instagram, and YouTube using AI-powered extraction
- **Discover Feed** - Swipe-based recipe discovery to find new meals
- **Meal Planning** - Schedule recipes by day and meal type (breakfast, lunch, dinner, snack)
- **Grocery Lists** - Auto-generated shopping lists from your meal plan with quantity aggregation
- **Pantry Tracking** - Keep track of ingredients you have on hand
- **Cookbooks** - Organize saved recipes into custom collections
- **Social** - Follow other users, share cooking posts, and engage with the community

## Tech Stack

- **Framework:** React Native 0.81 / Expo SDK 54
- **Backend:** Convex (real-time database)
- **Auth:** Clerk
- **UI:** Gluestack UI + NativeWind (Tailwind CSS)
- **Navigation:** Expo Router v6
- **State:** Zustand (client) + Convex (server)
- **Lists:** FlashList
- **Images:** expo-image

## Getting Started

### Prerequisites

- Node.js 18+
- iOS Simulator (Mac) or Android Emulator
- Expo Go app (for device testing)

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Configure the following:
   - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
   - `EXPO_PUBLIC_CONVEX_URL` - Convex deployment URL

3. Start the Convex development server:

   ```bash
   npx convex dev
   ```

4. Start the Expo development server:

   ```bash
   npm start
   ```

5. Open the app:
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go for physical device

## Project Structure

```
src/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Auth screens (sign-in, sign-up)
│   ├── (onboarding)/       # Onboarding flow
│   ├── (tabs)/             # Main tab screens
│   ├── recipe/             # Recipe detail screens
│   └── cookbook/           # Cookbook screens
├── components/
│   ├── ui/                 # Reusable UI components
│   └── features/           # Feature-specific components
├── hooks/                  # Custom React hooks
├── stores/                 # Zustand stores
├── constants/              # App constants and copy
├── services/               # Business logic
├── types/                  # TypeScript types
└── utils/                  # Utility functions

convex/
├── schema.ts               # Database schema
├── recipes.ts              # Recipe queries/mutations
├── users.ts                # User queries/mutations
├── mealPlan.ts             # Meal planning logic
└── groceries.ts            # Grocery list logic
```

## Scripts

- `npm start` - Start Expo development server
- `npm run ios` - Start on iOS Simulator
- `npm run android` - Start on Android Emulator
- `npm run lint` - Run ESLint

## License

Private - All rights reserved.
