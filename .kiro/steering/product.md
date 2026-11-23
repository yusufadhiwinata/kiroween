# Product: GRAVEYARD v4.0

Tagline: **Every Task Awakens a Forgotten Soul.**

GRAVEYARD is a real productivity app (task management, habits, focus timer, AI planning) wrapped in an animated Halloween world. The user is the last **Keeper**; completing work returns **Soul Energy** that restores four regions: Forgotten Cemetery, Pumpkin Village, Whispering Woods, Haunted Castle.

Source of truth for scope: #[[file:prd.md]]

## Non-negotiables
- The app must be genuinely usable, not a visual demo.
- Rewards (XP, levels, achievements, world progress) are validated server-side. Clients never write them.
- Works offline; syncs and re-validates on reconnect.
- Audio is a first-class feature but never required to understand the UI.
- Respect Reduce Motion everywhere; minimum 44dp touch targets; screen-reader labels on interactive elements.
- No private API key in the APK.

## Tone
Spooky-cozy, encouraging, never scary. The Dark Keeper is mysterious and kind. UI copy is short and concrete.

## Reward table (keep client and server in sync)
- Quest: Easy 10, Medium 25, Hard 50, Boss 100 XP. Caps per day: 25 rewarded quests, 3 Boss, 8 Hard.
- Ritual check-in: 15 XP (today or up to 2 days back).
- Focus: 5 XP per 5 minutes, max 60 per session, 240 rewarded minutes per day. Breaks earn 0.
- Soul Energy = XP earned; it fills unlocked regions in order.
- Level curve: cumulative XP to reach level L+1 = 100·L + 25·L·(L−1).
