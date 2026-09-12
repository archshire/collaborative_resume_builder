const labels = ['Name', 'Email', 'Phone', 'Location', 'LinkedIn', 'GitHub', 'Portfolio', 'Education', 'Certifications', 'Skills and tools'];
export function mountResumeImport(panel: HTMLElement) {
  const region = document.createElement('section'); region.className = 'resume-import';
  region.innerHTML = `<div class="resume-import-heading"><div><h3>Already have a resume?</h3><p>Upload it to suggest details for the fields below.</p></div><button type="button" class="secondary" id="upload-resume"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/></svg>Upload resume</button></div><input type="file" id="resume-file" accept=".pdf,.docx,.txt" hidden /><p class="note">PDF, Word (.docx) or text · up to 5 MB (text: 100 KB). Sent to OpenAI for extraction. Review before filling; existing entries are kept.</p><p id="resume-import-status" role="status"></p><div id="resume-import-review" hidden></div>`;
  panel.querySelector('.applicant-direct-section')!.before(region);
  const input = region.querySelector<HTMLInputElement>('#resume-file')!;
  const button = region.querySelector<HTMLButtonElement>('#upload-resume')!;
  const status = region.querySelector<HTMLElement>('#resume-import-status')!;
  const review = region.querySelector<HTMLElement>('#resume-import-review')!;
  button.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    input.value = ''; review.hidden = true; review.replaceChildren();
    if (!/\.(pdf|docx|txt)$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024 || (/\.txt$/i.test(file.name) && file.size > 100000)) {
      status.textContent = 'Choose a PDF or DOCX up to 5 MB, or a TXT file up to 100 KB.'; return;
    }
    button.disabled = true; status.textContent = `Reading ${file.name} with AI…`;
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('The file could not be read.')); reader.readAsDataURL(file); });
      const response = await fetch('/api/import-resume', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Resume-Client': '1' }, body: JSON.stringify({ name: file.name, data }), signal: controller.signal });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Resume extraction failed.');
      const fields = result.fields;
      if (!fields || labels.some(label => typeof fields[label] !== 'string')) throw new Error('The extracted fields were incomplete. Please try again.');
      const entries = labels.filter(label => fields[label].trim());
      if (!entries.length) { status.textContent = 'No profile details were found. You can enter them below.'; return; }
      const heading = document.createElement('h3'); heading.textContent = 'Review extracted details'; review.append(heading);
      const note = document.createElement('p'); note.textContent = 'Check against your resume, edit any mistakes, and untick anything you don’t want to use. These are self-reported details, not verified capabilities.'; review.append(note);
      for (const label of entries) {
        const row = document.createElement('div'); row.className = 'resume-suggestion';
        const selection = document.createElement('label');
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = true; checkbox.dataset.field = label;
        selection.append(checkbox, document.createTextNode(label));
        const value = document.createElement('textarea'); value.value = fields[label]; value.rows = 2; value.maxLength = 10000; value.setAttribute('aria-label', `Extracted ${label}`);
        row.append(selection, value); review.append(row);
      }
      const apply = document.createElement('button'); apply.className = 'primary'; apply.type = 'button'; apply.id = 'apply-resume-fields'; apply.textContent = 'Fill empty fields';
      apply.onclick = () => {
        let filled = 0, kept = 0;
        review.querySelectorAll<HTMLElement>('.resume-suggestion').forEach(row => {
          const checkbox = row.querySelector<HTMLInputElement>('input')!; if (!checkbox.checked) return;
          const field = Array.from(panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.applicant-direct-field')).find(item => item.dataset.label === checkbox.dataset.field);
          const value = row.querySelector('textarea')!.value.trim(); if (!field || !value) return;
          if (field.value.trim()) { kept++; return; }
          field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); filled++;
        });
        status.textContent = `Filled ${filled} empty field${filled === 1 ? '' : 's'}. ${kept ? `Kept ${kept} existing entr${kept === 1 ? 'y' : 'ies'}. ` : ''}You can edit your details below.`;
        review.hidden = true; review.replaceChildren();
      };
      const cancel = document.createElement('button'); cancel.className = 'ghost'; cancel.type = 'button'; cancel.textContent = 'Discard suggestions'; cancel.onclick = () => { review.hidden = true; review.replaceChildren(); status.textContent = 'Suggestions discarded. Your fields are unchanged.'; };
      review.append(apply, cancel); review.hidden = false; status.textContent = `Extracted ${entries.length} suggestions from ${file.name}. Nothing has been filled yet.`;
    } catch (error) { status.textContent = `${error instanceof Error && error.name !== 'AbortError' ? error.message : 'Extraction timed out. Try again.'} Your current fields have been kept.`; }
    finally { clearTimeout(timeout); button.disabled = false; }
  };
}
