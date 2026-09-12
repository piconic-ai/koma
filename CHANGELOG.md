# Changelog

## [v0.1.1](https://github.com/piconic-ai/koma/compare/v0.1.0...v0.1.1) - 2026-09-12

- Fix release branch push: fully qualify the destination ref by @kfly8 in https://github.com/piconic-ai/koma/pull/60
- Enable preview_urls so non-production builds get a URL by @kfly8 in https://github.com/piconic-ai/koma/pull/62
- Advance the release branch via GitHub API, not git push by @kfly8 in https://github.com/piconic-ai/koma/pull/63

## [v0.1.0](https://github.com/piconic-ai/koma/commits/v0.1.0) - 2026-09-12

- Phase 1: Spec model and frame utilities by @kfly8 in https://github.com/piconic-ai/koma/pull/1
- Ship koma: code animation video tool (Phases 1–9) by @kfly8 in https://github.com/piconic-ai/koma/pull/10
- Fix props is not defined error during transition playback by @kfly8 in https://github.com/piconic-ai/koma/pull/11
- Compact 4-koma style frame editor UI by @kfly8 in https://github.com/piconic-ai/koma/pull/12
- Export one PNG per frame instead of per-animation-tick by @kfly8 in https://github.com/piconic-ai/koma/pull/13
- Add video background and fixed-width code window by @kfly8 in https://github.com/piconic-ai/koma/pull/14
- Replace fade transitions with ultra-fast typing animation by @kfly8 in https://github.com/piconic-ai/koma/pull/15
- Switch preview to canvas renderer, add frame gaps, green background by @kfly8 in https://github.com/piconic-ai/koma/pull/17
- Unify export into single button that downloads MP4 + PNGs zip by @kfly8 in https://github.com/piconic-ai/koma/pull/16
- Refactor barefootjs#1545 workaround: deduplicate renderer, remove dead code by @kfly8 in https://github.com/piconic-ai/koma/pull/18
- Fix 5 timeline bar bugs: listener leak, magic number, DOM rebuild, zero-div, at-min feedback by @kfly8 in https://github.com/piconic-ai/koma/pull/19
- Fix seek/playhead mismatch with transition-aware position mapping (#7) by @kfly8 in https://github.com/piconic-ai/koma/pull/21
- Refactor TimelineBar: signal-based state and CSS class for at-min by @kfly8 in https://github.com/piconic-ai/koma/pull/22
- Add CI workflow and expand test coverage by @kfly8 in https://github.com/piconic-ai/koma/pull/23
- Migrate from npm/vitest to bun by @kfly8 in https://github.com/piconic-ai/koma/pull/24
- Fix timeline edge drag hover bug and add per-segment visual feedback by @kfly8 in https://github.com/piconic-ai/koma/pull/25
- Add hover tooltip showing time position on timeline bar by @kfly8 in https://github.com/piconic-ai/koma/pull/26
- Cherry-pick: Make timeline bar scrollable and stop auto-maximizing width by @kfly8 in https://github.com/piconic-ai/koma/pull/28
- Fix playback indicator slowdown during transitions by @kfly8 in https://github.com/piconic-ai/koma/pull/29
- Shorten default hold durations and fill bar width for initial frames by @kfly8 in https://github.com/piconic-ai/koma/pull/30
- Auto-scroll timeline when edge drag extends beyond viewport by @kfly8 in https://github.com/piconic-ai/koma/pull/31
- Add preset themes (piconic / Hono / Barefoot.js) by @kfly8 in https://github.com/piconic-ai/koma/pull/32
- Make the video preview area resizable in height by @kfly8 in https://github.com/piconic-ai/koma/pull/33
- Update barefootjs to 0.5.0 by @kfly8 in https://github.com/piconic-ai/koma/pull/35
- Show transitions as resizable segments in the timeline bar by @kfly8 in https://github.com/piconic-ai/koma/pull/36
- Bump @barefootjs to 0.5.1 and drop the flex-basis reactivity workaround by @kfly8 in https://github.com/piconic-ai/koma/pull/37
- Leave the playhead at the end after playback instead of rewinding by @kfly8 in https://github.com/piconic-ai/koma/pull/38
- Show a hover tip with each theme's tagline and homepage by @kfly8 in https://github.com/piconic-ai/koma/pull/39
- Stop showing the theme hover tip (fixes theme switching on mobile) by @kfly8 in https://github.com/piconic-ai/koma/pull/40
- Add 13 selectable languages and sort the picker alphabetically by @kfly8 in https://github.com/piconic-ai/koma/pull/41
- Fix theme picker showing "Barefoot.js" for the Hono option by @kfly8 in https://github.com/piconic-ai/koma/pull/42
- Per-frame language and a mobile-focused UX pass by @kfly8 in https://github.com/piconic-ai/koma/pull/43
- Add P2B Haus preset + per-theme default koma by @kfly8 in https://github.com/piconic-ai/koma/pull/44
- Add animated GIF to the export bundle by @kfly8 in https://github.com/piconic-ai/koma/pull/45
- Test the export paths (MP4, GIF, combined) by @kfly8 in https://github.com/piconic-ai/koma/pull/46
- Pin @barefootjs to 0.5.3 (exact), fix escapeAttr mismatch, restore Barefoot.js sample by @kfly8 in https://github.com/piconic-ai/koma/pull/47
- Pin @barefootjs/* to exact 0.5.3 (no caret) by @kfly8 in https://github.com/piconic-ai/koma/pull/48
- Bump @barefootjs/* to 0.6.0 and restore .map() theme items by @kfly8 in https://github.com/piconic-ai/koma/pull/49
- Eliminate App fallback bindings and add memo barriers by @kfly8 in https://github.com/piconic-ai/koma/pull/51
- Convert dead memos to plain functions in Player by @kfly8 in https://github.com/piconic-ai/koma/pull/52
- Expand tests for resize interactions and Player wiring by @kfly8 in https://github.com/piconic-ai/koma/pull/53
- Migrate the build to Vite and bump @barefootjs/* to 0.31.4 by @kfly8 in https://github.com/piconic-ai/koma/pull/54
- Bump @barefootjs/* to 0.31.5 by @kfly8 in https://github.com/piconic-ai/koma/pull/55
- Bump @barefootjs/* to 0.35.5 by @kfly8 in https://github.com/piconic-ai/koma/pull/56
- Add Renovate config by @kfly8 in https://github.com/piconic-ai/koma/pull/57
- Set up tagpr release flow by @kfly8 in https://github.com/piconic-ai/koma/pull/58
