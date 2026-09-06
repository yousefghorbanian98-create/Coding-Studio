# ADR-0005: No terminal scraping

Status: accepted · Milestone One · 2026-09-05

## Decision

Coding Studio never parses, scrapes, or interprets Jcode's visual TUI output.

Enforcement, implemented and tested in this milestone:

- The only accepted machine bytes are **single-line JSON objects** on the
  protocol channel. `FrameDecoder` rejects any line containing raw control
  bytes (including ANSI/VT `ESC`) before JSON parsing — TUI render output is
  structurally incapable of satisfying the decoder.
- The decoder rejects concatenated frames, non-object JSON, wrong/unknown
  major versions, and frames over `MAX_FRAME_BYTES` (4 MiB).
- stderr is classified strictly as diagnostics (`classify_stream_bytes`):
  bytes containing terminal control sequences are labelled `TerminalControl`
  and can never enter the event stream.
- Integration test `no_terminal_scraping_possible` replays synthetic TUI
  output (colorized box-drawing with ANSI escapes) through the adapter and
  proves every line errors instead of producing an event.

## Consequences

- If the harness API ever disappears, Milestone One's successor gates block
  rather than degrade into scraping (mission rule, unchanged).
