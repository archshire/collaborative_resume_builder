# collaborative_resume_builder AI Collaboration

## Purpose

This document records high-level AI collaboration moments that materially shaped collaborative_resume_builder.

It is not a raw prompt log or implementation diary.

## Collaboration Model

```text
Builder Intent
      +
AI Observation
      |
      v
Emergent Insight
      |
      v
Engineering Decision
      |
      v
Repository Evidence
```

## AI Collaboration Roles

| Role | Contribution | Boundary |
| --- | --- | --- |
| Builder | Defines purpose, tests output, accepts or rejects product direction, and makes final decisions. | Human authority remains final. |
| Arche Reconstruction & Engineering Nexus (AREN) | A custom GPT used before implementation for high-level reasoning, vision clarity, and architectural framing. AREN helped produce the North Star and Architecture documents before the project moved into Codex implementation. | Does not replace builder judgment or become the runtime product. |
| KRYSTALIZE | Used with Codex to further stabilize implementation clarity: locked truths, ambiguity, rationale, dependencies, and semantic evolution. | Records meaning and reasoning; does not decide product direction alone. |
| Codex | Implements code, updates docs, runs checks, and turns stabilized decisions into repository artifacts. | Executes and explains changes; does not invent unsupported product claims. |
| Gemini / OpenAI | Runtime AI services for transcription, resume generation, skill-profile generation, and follow-up question generation. | Must use transcript evidence as the source of truth for candidate claims. |

## Collaboration Sequence

```text
Builder intent
-> AREN high-level reasoning
-> North Star and Architecture vision clarity
-> Codex + KRYSTALIZE implementation clarity
-> Codex implementation
-> Gemini/OpenAI runtime assistance inside the app
```

The manner of building is deliberate: achieve clarity before build. AREN helped clarify what the project should be and why it matters. Codex and KRYSTALIZE then helped convert that vision into staged implementation decisions, state documents, and working code.

## Collaboration Moments

### HC-001 - Choose the Individual Project

| Stage | Details |
| --- | --- |
| Builder Intent | Build the first individual-use project prototype. |
| AI Observation | The resume interview assistant is the clearest individual-use vertical slice. |
| Emergent Insight | collaborative_resume_builder can prove Project Listen through one focused workflow. |
| Engineering Decision | Start with the Resume Interview Assistant before the meeting intelligence app. |
| Repository Evidence | `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md` |

### HC-002 - Prefer Wiring Existing Capabilities

| Stage | Details |
| --- | --- |
| Builder Intent | Avoid building speech recognition, document editing, and storage from scratch if existing tools can be wired together. |
| AI Observation | Browser recording, Gemini/API transcription, and Google Docs output can be staged rather than solved all at once. |
| Emergent Insight | A manual-transcript MVP can validate the core journey before automation. |
| Engineering Decision | Build MVP around recording, transcript input, resume generation, and skill visualization; defer automated transcription. |
| Repository Evidence | `docs/ARCHITECTURE.md`, `docs/K_COLLABORATIVE_RESUME_BUILDER_CONSTITUTIONAL_STATE.md` |

### HC-003 - Separate Prototype Stages

| Stage | Details |
| --- | --- |
| Builder Intent | Understand whether proposed POC versions were alternatives or stages. |
| AI Observation | The workflow naturally grows from manual transcript paste to Google integration to automated transcription. |
| Emergent Insight | Staging reduces risk and makes the build explainable. |
| Engineering Decision | Treat manual transcript input, Google integration, and automated transcription as staged evolution. |
| Repository Evidence | `docs/ARCHITECTURE.md` |

### HC-004 - Name the Tool for the Collaborative Resume Project

| Stage | Details |
| --- | --- |
| Builder Intent | Make the app name point clearly to the collaborative resume project and its intended 42 student users. |
| AI Observation | The earlier working name, Earfully Resume, described interview listening but did not foreground the collaborative_resume project. |
| Emergent Insight | A boring, clear name is better for adoption than a clever name that users must decode. |
| Engineering Decision | Use `collaborative_resume_builder` as the project-facing name, with the description "A tool to help 42 students in Circle 6 enjoy the project without multitasking." |
| Repository Evidence | `README.md`, `docs/NORTH_STAR.md`, `docs/K_COLLABORATIVE_RESUME_BUILDER_CONSTITUTIONAL_STATE.md` |

### HC-005 - Separate AI Collaboration Roles

| Stage | Details |
| --- | --- |
| Builder Intent | Make the AI collaboration account more honest by naming the different roles involved, especially AREN's pre-Codex role. |
| AI Observation | The project used AI in phases: AREN for high-level reasoning and vision clarity; Codex + KRYSTALIZE for implementation clarity; Gemini/OpenAI for runtime app behavior. |
| Emergent Insight | The important method is not "AI helped"; it is "clarity before build." Vision clarity came before implementation clarity, and implementation clarity came before coding. |
| Engineering Decision | Document AREN as the custom GPT used to produce North Star and Architecture clarity before moving to Codex/KRYSTALIZE for implementation planning and build execution. |
| Repository Evidence | `README.md`, `docs/AI_COLLABORATION.md`, `docs/K_COLLABORATIVE_RESUME_BUILDER_CONSTITUTIONAL_STATE.md` |

## Criteria for Future Entries

Add an entry when:

- the builder's mental model changes;
- a major engineering direction changes;
- repository artifacts are updated to preserve the reasoning.

Do not record routine syntax help or small implementation details here.
