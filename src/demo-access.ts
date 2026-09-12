export type DemoRole = 'applicant' | 'company';
export const credentials = { applicant: { name: 'applicant', password: 'hireme' }, company: { name: 'company', password: 'rightfit' } };
export function acceptsDemoLogin(role: DemoRole, name: string, password: string): boolean {
  return name.trim() === credentials[role].name && password === credentials[role].password;
}
export type Requirement = { text: string; basis: 'stated' | 'interpretation'; sourceQuote: string };
export type ApprovedMaterial = { name: string; text: string; company: string; jobDescription: string; version: number };
export function approveMaterial(name: string, text: string, company: string, jobDescription: string, version: number): ApprovedMaterial {
  return { name: name.trim() || 'Applicant', text: text.trim(), company, jobDescription, version };
}
export function applicantTurns(transcript: string, name: string): string {
  const result: string[] = [];
  let active = false;
  for (const line of transcript.split(/\r?\n/)) {
    const match = line.match(/^([^:]{1,100}):\s*(.*)$/);
    if (/^(Transcript chunk|INITIAL INTERVIEW|FOLLOW-UP INTERVIEW)/i.test(line)) { active = false; continue; }
    if (match) {
      const label = match[1].trim().toLowerCase();
      active = !/^(recruiter|interviewer|speaker\s*\d+|unknown speaker)$/.test(label) &&
        (/^(applicant|candidate|student)$/.test(label) || Boolean(name && label === name.toLowerCase()));
      if (active) result.push(match[2]);
    } else if (active) result.push(line);
  }
  return result.join('\n').trim();
}
