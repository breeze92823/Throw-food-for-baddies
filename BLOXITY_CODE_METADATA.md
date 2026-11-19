---
# Answers to the Bloxity SDK integration questions (docs.bloxity.io, used by audit_sdk / review).
canDie: false # no death: the game has no way to lose
hasScore: true # leaderboards: best-pull, baddies-caught, money-per-second (declared in src/config.js, reported by the server)
rewards: true # rewarded ads: "2x Income", "Cash Boost", "Free Lucky Throw" (config ADS), granted only on `completed` and a server-verified token
notApplicable:
  - feature: death-screen
    reason: The player cannot die.
  - feature: gems
    reason: By design nothing in this game costs a premium currency; every price is in-game money (see CLAUDE.md).
  - feature: party-own-server-flow
    reason: The game runs on Bloxity-hosted servers, where party play is automatic (SDK loaded from the pinned URL before matchmaking, matchmaker via net.resolveEndpoint, room maxClients = 5 = one player per base).
  - feature: custom-characters
    reason: The game dresses its own rig with the manual cosmetics path (skin, parts, hat / back); a worn custom character falls back to the standard avatar.
---

# Throw Food for Baddies: Bloxity integration notes

SDK integrations in the client (`src/bloxity.js` is the only place that calls the SDK):

- init, loading steps, `loadingEnd` + `gameplayStart` after the first frame, `gameplayEnd` on unload
- auth (`onUserChanged`) and the player's token (`getToken`), sent to the game server which verifies it with Bloxity
  (`POST /v1/auth/game-token/verify`); the server never trusts a user id the client sends
- settings: `graphics_quality`, `camera_sensitivity`, `show_fps`, `fullscreen`, `master_volume`, `music_volume`
- avatar + proportions, avatar customizer, `respawn_request`, `portal.showMenu` on Esc, reserved UI areas
- other players' looks: `getSkinTextureUrlFor` + the replicated equipped ids and proportions
- ads: break handlers (pause + mute), `declareScreens` (`gameplay` off, `panel`): no banners while the player plays, only while a window is open,
  rewarded ads (`showRewarded`, verified with `/v1/ads/reward/verify` on the server)
- leaderboards: `leaderboard.define` (client) + hosted score reports (server, `src/reporter.ts`: `/v1/leaderboards/hosted/{gameId}/report`
  with `BLOXITY_REPORT_TOKEN`, verified accounts only, as `legion_<id>`); the plaza boards show the server's real top lists
- chat bubbles (`chat.onMessage`, `attachBubble`) and emotes (`registerFeature('emotes')`, `play_emote`, `src/avatar/emotes.js`)
- party play: automatic on Bloxity hosting; `party.enable` + `party.joined`
- Open Rooms: the backend runs the room reporter (`src/legion-room-reporter.ts`, needs the `MATCHMAKER_REPORT_URL`,
  `BLOXITY_REPORT_TOKEN` and `BLOXITY_GAME_ID` that Bloxity hosting injects), the client reports its room with `updateRoom`
  (`relay~room`) and joins a `?roomId=` launch through the pod's relay (`locateRoom`)
- friend invites: `social.getInviteFriendsLink({ roomId, ref })` (ref = the inviter's verified account id); a new verified player who opens the game from the link credits the inviter once on the server (income boost)
- multiplayer: matchmaker `net.resolveEndpoint`, `updateRoom`, the `?roomId=` launch room, friend-join toasts
  (`playerJoined` / `playerInRoom`), friends in the room boost income, invite link; room size = the number of bases in the hub
