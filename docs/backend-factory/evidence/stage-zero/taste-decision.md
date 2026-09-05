# Taste Skill Decision

## Repository metadata

- Repository URL: `https://github.com/Leonxlnx/taste-skill`
- Inspected commit SHA: `ccbc15639c97057cbfcf32ecebc38ef716e4bb37`
- Default branch: `main`
- License: MIT
- Description upstream: "Taste-Skill - gives your AI good taste. stops the AI from generating boring, generic slop"

## Selected skill

- Selected skill: `design-taste-frontend`
- Path: `skills/taste-skill/SKILL.md`
- The repository also exposes image-generation and alternative UI skills. The selected skill is the frontend anti-slop skill directly aligned with the user directive "Taste Skill must supervise all user-facing changes."

## Applicable rules

The selected skill governs only user-facing presentation:

- brief inference and anti-default discipline
- design system selection and honest implementation
- layout, typography, color, motion, density and spacing directives
- performance and accessibility guardrails
- dark mode, reduced motion and z-index restraint
- AI tells (forbidden visual, typography, layout, content and production-test patterns)
- em-dash ban for visible text
- pre-flight check before shipping user-facing work

## Rejected rules

- Dashboard, data-table and multi-step product UI are explicitly outside the
  skill's stated target; Coding Studio uses its own product design system for
  those surfaces.
- Anti-slop bans (version-eyebrows, decorative status dots, em-dash ban, locale
  strips) are presentation rules and are not applied to backend mission
  documents or machine-readable state. Internal technical documents are not
  product UI copy.
- Any rule that would override accessibility, performance, existing design
  system or target hardware constraints is rejected, per the user directive.

## Backend limitations

The skill contains no backend architecture, API, authentication, process
supervision, protocol, event model or security authority. It cannot approve or
reject backend architecture or security decisions. The user directive is
explicit: Taste Skill must not control backend architecture or security.

## Decision

**Taste gate not applicable to product UI in Stage Zero.**

Stage Zero changes no user-facing product interface. It materializes backend
mission documents, machine state and a deterministic validator. The Taste gate is
instead recorded as a structural requirement: any future stage that changes
user-facing UI must carry a Taste decision in `.factory/stages.json`, and the
mission validator fails when a UI-changing stage has no Taste decision.

Taste Skill is not copied, not installed via `npx`, and not added as a production
dependency.
