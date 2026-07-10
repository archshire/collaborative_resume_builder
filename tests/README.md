# Verification Checklist

This checklist records how the prototype was verified before submission.

The purpose is not to claim full production test coverage. It is to show that the builder checked the main user journey, known runtime dependencies, and expected failure paths.

## Automated / Command Checks

- [x] Run `npm install`
- [x] Run `npm run build`
- [x] Run `node --check server/index.cjs`

## Local App Startup

- [x] Create `.env` from `.env.example`
- [x] Add at least one API key for automated AI features
- [x] Run `npm run build`
- [x] Run `npm run serve`
- [x] Open `http://localhost:4173`

## Part 1 - Initial Interview

- [x] Enter recruiter name
- [x] Enter applicant name
- [x] Confirm recording is blocked if either name is missing
- [x] Use `Check Mic` and confirm mic level/waveform responds
- [x] Record Part 1 interview audio
- [x] Stop recording
- [x] Confirm audio file appears in the recording list
- [x] Download audio file
- [x] Transcribe audio file
- [x] Confirm transcript appears with speaker labels
- [x] Confirm the same audio file cannot be transcribed repeatedly after successful transcription
- [x] Generate initial resume
- [x] Generate skill profile
- [x] Review interview feedback and follow-up questions

## Part 2 - Follow-up Questions

- [x] Confirm follow-up recording is blocked before clicking the ready button
- [x] Click `Ready to ask follow-up questions`
- [x] Record follow-up audio
- [x] Stop recording
- [x] Transcribe follow-up audio
- [x] Re-generate resume using combined evidence
- [x] Re-generate skill profile using updated evidence
- [x] Save final resume as PDF

## Fallback / Responsibility Checks

- [x] Confirm manual transcription fallback is shown if automated transcription fails
- [x] Confirm skill-profile percentages are labelled as AI evidence estimates
- [x] Confirm generated resume does not invent unsupported candidate claims during test run
- [x] Confirm test-only or interviewer-only transcripts return an insufficient-evidence response
- [x] Confirm irrelevant or absurd applicant claims return an insufficient-evidence response
- [x] Confirm broad self-claims are not treated as evidence unless backed by concrete examples
- [x] Confirm `.env` is not committed or included in public submission

## Verification Run

Date: 2026-07-10

Builder: Dan Yeo

Notes: Manual browser verification completed by the builder. Command checks were re-run by Codex after the final UI and backend guardrail changes.
