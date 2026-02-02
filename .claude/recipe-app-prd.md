# Product Requirements Document: RecipeFlow

## Overview

RecipeFlow is a mobile application that transforms video content from social platforms (TikTok, Instagram Reels, YouTube Shorts) into actionable, personalized recipes. The app combines intelligent recipe extraction with hands-free cooking assistance and a social sharing experience.

---

## Goals & Success Metrics

### Primary Goals
- Enable users to capture recipes from video content effortlessly
- Provide a personalized cooking experience that respects dietary needs
- Streamline the path from recipe discovery to grocery delivery
- Create a social community around home cooking achievements

### Key Metrics
- Recipe creation rate (target: 80% of users create 1+ recipe in first week)
- Grocery cart conversion rate
- Cook-through completion rate
- Social engagement (posts, likes, comments)
- Annual recipe goal completion rate

---

## User Personas

**The Scroll-to-Cook User**: Discovers recipes on TikTok/Reels, wants to actually make them but loses track or finds the process too manual.

**The Dietary-Conscious Home Cook**: Has specific restrictions (allergies, preferences, macros) and needs recipes adapted automatically.

**The Social Foodie**: Wants to share cooking achievements and discover what friends are making.

---

## Core Features

### 1. Onboarding & Personalization

#### 1.1 Annual Recipe Goal
- User sets a target number of recipes to create/cook this year
- Progress tracked on home screen with visual indicator
- Optional reminders and encouragement notifications

#### 1.2 Dietary Profile Setup
- **Dietary Restrictions**: Vegetarian, Vegan, Gluten-Free, Dairy-Free, Keto, Paleo, Halal, Kosher, Nut-Free, Shellfish-Free, etc.
- **Ingredient Dislikes**: Free-form entry for specific ingredients to avoid (cilantro, olives, etc.)
- **Allergy Severity Levels**: Warning vs. Hard Block
- Profile can be edited anytime from settings

#### 1.3 Preference Storage
- All preferences stored locally and synced to cloud
- Used to generate ingredient labels throughout the app

---

### 2. Video-to-Recipe Extraction

#### 2.1 Link Input
- User pastes a link from TikTok, Instagram Reels, YouTube Shorts, or other video platforms
- URL validation and platform detection

#### 2.2 Share Sheet Integration (Share-to-App)
*Similar to Beli's share-to-save functionality*

- RecipeFlow appears as a share target in the native iOS/Android share sheet
- User can share directly from TikTok, Instagram, YouTube, or any app with a shareable link
- **Flow**:
  1. User finds a recipe video in TikTok/Instagram/etc.
  2. Taps share button within that app
  3. Selects RecipeFlow from share sheet
  4. RecipeFlow opens (or processes in background) and begins recipe extraction
  5. Push notification when recipe is ready: "Your recipe for [Dish Name] is ready!"
  6. Tapping notification opens the generated recipe for review
- **Background Processing**: If user doesn't open the app, processing continues in background
- **Queue Management**: Multiple shares queue up and process sequentially
- **Confirmation Toast**: Brief in-app confirmation when share is received ("Got it! Processing your recipe...")
- **Share History**: View pending and recently processed shares in a dedicated section

#### 2.2 Content Processing
- Extract video content via platform APIs or scraping where permitted
- AI analysis of video to identify:
  - Dish name and cuisine type
  - Ingredients (with quantities when visible/mentioned)
  - Cooking steps and techniques
  - Equipment needed
- Audio transcription for spoken instructions
- Visual frame analysis for unspoken steps

#### 2.3 Recipe Generation
- Structured recipe output with:
  - Title and description
  - Cuisine tags
  - Estimated prep time and cook time
  - Difficulty rating (Easy / Medium / Hard)
  - Serving size (adjustable)
  
#### 2.4 Nutritional Analysis
- Calorie count per serving
- Macro breakdown: Protein, Carbs, Fat
- Key micronutrients when relevant
- Dietary labels auto-applied (Vegan, GF, etc.)

#### 2.5 Personalized Ingredient Labels
Based on user's dietary profile, each ingredient displays contextual labels:
- 🔴 **Swap Required**: Conflicts with restriction/allergy
- 🟡 **Disliked**: User has marked as disliked
- 🟢 **Good**: No issues
- Suggested substitutions provided for flagged ingredients

---

### 3. Recipe Detail View

*Modeled after Recime's recipe presentation*

#### 3.1 Overview Section
- Hero image (extracted from video or placeholder)
- Recipe title and creator attribution (original video source)
- Quick stats bar: Time | Difficulty | Calories | Servings
- Dietary badges
- Save to Cookbook button
- Share button

#### 3.2 Ingredients Tab
- Full ingredient list with quantities
- Serving size adjuster (scales all quantities)
- Ingredient labels based on dietary profile
- Checkbox for each ingredient (for shopping/prep)
- "Add to Grocery List" button

#### 3.3 Nutritional Information Tab
- Detailed macro/micro breakdown
- Per-serving and per-recipe totals
- Visual charts for macro distribution

#### 3.4 Instructions Tab
- Numbered step-by-step instructions
- Time estimates per step where applicable
- Tips and notes extracted from video
- Equipment callouts

---

### 4. Cooking Modes

#### 4.1 Cook by Steps (Flashcard Mode)
- Full-screen flashcard interface
- One step per card with large, readable text
- Swipe or tap to advance
- Progress indicator (Step 3 of 12)
- Timer integration for timed steps
- "Previous" and "Next" navigation
- Exit button returns to full recipe

#### 4.2 Voice Assistant Mode (Hands-Free Cooking)
- Activated via "Start Cooking with Voice" button
- Wake word or always-listening mode during active cooking session
- Capabilities:
  - "What's the next step?"
  - "Repeat that"
  - "Go back to step 3"
  - "How much butter do I need?"
  - "Set a timer for 10 minutes"
  - "What temperature should the oven be?"
- Context-aware responses based on current recipe
- Visual display shows current step while voice is active
- Hands-free timer controls
- End session command

---

### 5. Grocery List & Amazon Fresh Integration

#### 5.1 Grocery List Management
- Add ingredients from any recipe
- Aggregate ingredients across multiple recipes
- Quantity consolidation (2 recipes need onions → combined)
- Manual add/edit/remove items
- Check off items while shopping
- Clear completed items

#### 5.2 Amazon Fresh Export
- "Order on Amazon Fresh" button
- Opens Amazon Fresh with pre-populated cart
- Ingredient matching to Amazon Fresh products
- Quantity mapping
- Substitution suggestions for unavailable items
- Deep link or API integration depending on Amazon partnership

---

### 6. Cookbook (Recipe Library)

#### 6.1 Saved Recipes
- Grid or list view of all saved recipes
- Filter by:
  - Cuisine
  - Dietary tags
  - Difficulty
  - Time
  - Cooked vs. Not Yet Cooked
- Search functionality
- Sort by date added, alphabetical, rating

#### 6.2 Collections
- Create custom collections (Weeknight Dinners, Date Night, etc.)
- Add recipes to multiple collections
- Share collections with friends

#### 6.3 Recipe Progress
- Track which recipes have been cooked
- Date last cooked
- Personal notes and modifications

---

### 7. Post-Cook Experience

*Modeled after Beli's post-experience flow*

#### 7.1 Completion Flow
Triggered after exiting Cook Mode or manually:
- "How did it turn out?" prompt
- Rating (1-5 stars or emoji scale)
- Upload photos:
  - Final dish (required for posting)
  - Progress shots (optional, multiple)
- Caption/review text
- Difficulty feedback (Was this easier/harder than expected?)
- "Would you make this again?" toggle
- Time accuracy feedback

#### 7.2 Post Creation
- Combine photos into a shareable post
- Auto-generate suggested caption based on recipe
- Tag the recipe
- Choose visibility: Public / Friends Only / Private
- Post to feed or save as private note

---

### 8. Social Feed

*Modeled after Beli's social experience*

#### 8.1 Home Feed
- Chronological or algorithmic feed of friends' posts
- Post cards show:
  - User avatar and name
  - Photo(s) of completed dish
  - Recipe name (tappable to view recipe)
  - Rating
  - Caption
  - Like and comment counts
- Pull to refresh

#### 8.2 Interactions
- Like posts
- Comment on posts
- Save recipe from post to own cookbook
- Share post externally

#### 8.3 User Profiles
- Profile photo and display name
- Bio
- Stats: Recipes cooked, Posts, Followers, Following
- Recipe goal progress (X of Y recipes this year)
- Grid of cooking posts
- Saved/public collections
- Follow/unfollow button

#### 8.4 Discovery
- Explore tab with trending posts
- Search for users
- Suggested users to follow
- Popular recipes this week

#### 8.5 Notifications
- New followers
- Likes on posts
- Comments on posts
- Friends saved your recipe
- Recipe goal milestones

---

## Technical Considerations

### Video Processing Pipeline
- Support for major platforms: TikTok, Instagram, YouTube
- Fallback to audio transcription if video analysis fails
- Rate limiting and caching to manage API costs
- Queue system for processing during high load

### AI/ML Requirements
- Vision model for food identification and step extraction
- Speech-to-text for audio transcription
- NLP for instruction parsing and structuring
- Nutritional database integration (USDA, nutritionix, etc.)

### Voice Assistant
- On-device processing preferred for latency
- Fallback to cloud for complex queries
- Noise handling for kitchen environment
- Multi-language support (future)

### Data Privacy
- Video links not stored after processing
- User dietary data encrypted
- Social posts respect visibility settings
- GDPR/CCPA compliance

---

## Information Architecture

```
Home
├── Recipe Goal Progress
├── Quick Actions (Add Recipe, Recent)
└── Feed Preview

Add Recipe
├── Paste Link
├── Processing Status
└── Generated Recipe Preview

Recipe Detail
├── Overview
├── Ingredients
├── Nutrition
├── Instructions
├── Cook by Steps
└── Voice Assistant Mode

Cookbook
├── All Recipes
├── Collections
├── Filters & Search
└── Cooked History

Grocery List
├── Current List
├── Amazon Fresh Export
└── List History

Social Feed
├── Home Feed
├── Explore
├── Notifications
└── Search

Profile
├── My Posts
├── My Stats
├── Collections
├── Settings
└── Dietary Profile
```

---

## MVP Scope

### Phase 1 (MVP)
- Onboarding with dietary profile and recipe goal
- Video link to recipe extraction (TikTok, Instagram)
- Basic recipe detail view with ingredients and instructions
- Ingredient labeling based on dietary profile
- Cook by Steps flashcard mode
- Cookbook with save functionality
- Basic grocery list (no Amazon integration)

### Phase 2
- Voice assistant cooking mode
- Amazon Fresh cart export
- Post-cook photo upload and rating
- Basic social feed (friends only)

### Phase 3
- Full social features (explore, discovery)
- Collections and sharing
- Nutritional tracking integration
- Multi-platform video support expansion
- Recipe modification and personalization suggestions

---

## Open Questions

1. **Video Platform TOS**: What level of video content extraction is permitted per platform? May need to partner or use official APIs.

2. **Amazon Fresh Partnership**: API access vs. deep linking vs. manual cart population?

3. **Voice Assistant Implementation**: On-device (privacy, offline) vs. cloud (accuracy, features)?

4. **Monetization Model**: Freemium with limits? Subscription? In-app purchases for collections?

5. **Content Moderation**: How to handle inappropriate posts in social feed?

6. **Attribution**: How to properly credit original video creators?

---

## Appendix

### Competitive References
- **Recime**: Recipe organization, step-by-step cooking UI, ingredient scaling
- **Beli**: Social posting flow, feed design, user profiles, rating system
- **Mealime**: Grocery list management, dietary customization
- **Paprika**: Recipe extraction (from websites), cookbook organization

### User Research Needed
- Cooking frequency and recipe discovery habits
- Pain points with current video-to-recipe workflow
- Grocery shopping behavior and delivery preferences
- Social sharing motivations in food context
