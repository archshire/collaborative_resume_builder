# collaborative_resume_builder Architecture

## Purpose

This document defines the project-level architecture for collaborative_resume_builder.

It adapts the broader Project Listen platform idea into the first individual-use application.

## System Overview

```text
Interview Conversation
        |
        v
Browser Audio Recorder
        |
        v
Audio Chunks
        |
        v
Transcript Input / Transcription Layer
        |
        v
Structured Interview Understanding
        |
        v
Artifact Generator
        |
        +--> Resume Draft
        |
        +--> Evidence-backed Skill Profile
```

## Current Prototype Architecture

The current build has moved beyond the original manual-transcript MVP. It now includes a browser frontend and a local Node backend.

```text
Browser recorder
-> downloadable 10-minute audio chunks
-> browser audio upload as base64
-> local backend transcription
-> transcript returned to browser
-> evidence-governed resume/profile generation
-> follow-up interview loop
-> updated resume/profile generation
-> local artifact export
```

## Planned Automation Path

After the local workflow is stable, cloud document automation can be added.

```text
Browser recorder
-> local or cloud transcription
-> resume and skill profile generated
-> optional Google login
-> optional Drive storage
-> optional Google Doc output
```

## Component Responsibilities

| Component | Responsibility |
| --- | --- |
| Audio Recorder | Capture microphone audio in controlled chunks. |
| Recording Store | Preserve audio files locally for download and future upload. |
| Transcript Layer | Transcribe uploaded audio through the local backend, with manual fallback. |
| Local Backend | Keep API keys server-side and coordinate Gemini/OpenAI calls. |
| Semantic Processor | Ask AI providers to extract candidate facts, skills, interests, evidence, and gaps from transcript evidence. |
| Resume Generator | Produce a professional resume draft from structured understanding and transcript evidence. |
| Skill Profile Visualizer | Render evidence-backed strengths, interests, fit, and deficiencies. |
| Follow-up Loop | Turn missing evidence into second-pass interview questions and updated artifacts. |

## Architectural Boundaries

Speech capture must not perform resume generation.

Resume generation must not invent unsupported claims.

Visualization must be backed by transcript-derived evidence.

External AI services should be replaceable where practical.

For implementation-level details, see `TECHNICAL_BUILD.md`.

## Open Decisions

| ID | Decision | Status |
| --- | --- | --- |
| OD-001 | Final default transcription provider for broad student use | Open |
| OD-002 | Whether generated resumes become Google Docs in v2 | Open |
| OD-003 | Exact skill-profile visualization format | Open |
| OD-004 | Whether to add persistent storage or keep local artifact export only | Open |
