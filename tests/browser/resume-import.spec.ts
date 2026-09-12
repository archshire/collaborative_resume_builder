import { test, expect, type Page } from '@playwright/test';
const fields = {Name:'Sam Lee',Email:'sam@example.com',Phone:'',Location:'Singapore',LinkedIn:'',GitHub:'',Portfolio:'',Education:'Diploma in Business',Certifications:'','Skills and tools':'Event coordination'};
async function open(page: Page) {
  await page.goto('/applicant');await page.locator('#login-name').fill('applicant');await page.locator('#login-password').fill('hireme');await page.locator('#login-form button').click();
  await expect(page.locator('[data-tab="opportunity"]')).toContainText('Job Opportunity');
  await page.locator('[data-tab="applicant"]').click();
}
test('resume upload reviews suggestions and fills only fields still empty at approval', async ({page})=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/import-resume',async route=>{expect(route.request().postDataJSON().name).toBe('resume.txt');await gate;await route.fulfill({json:{fields}});});
  await open(page);await page.locator('#applicant-info-name').fill('My existing name');
  const chooser=page.waitForEvent('filechooser');await page.locator('#upload-resume').click();await (await chooser).setFiles({name:'resume.txt',mimeType:'text/plain',buffer:Buffer.from('Sam Lee\nsam@example.com')});
  await page.locator('[data-label="Location"]').fill('My current location');release();
  await expect(page.locator('#resume-import-review')).toBeVisible();await expect(page.locator('[data-label="Email"]')).toHaveValue('');
  await page.getByLabel('Extracted Email',{exact:true}).fill('corrected@example.com');
  await page.locator('#apply-resume-fields').click();
  await expect(page.locator('[data-label="Email"]')).toHaveValue('corrected@example.com');
  await expect(page.locator('#applicant-info-name')).toHaveValue('My existing name');await expect(page.locator('[data-label="Location"]')).toHaveValue('My current location');
  await page.locator('[data-tab="interview"]').click();await expect(page.locator('#applicant-name')).toHaveValue('My existing name');
});
test('resume failures, discard and unsupported files preserve the editable form on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});await open(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('[data-label="Email"]').fill('kept@example.com');
  await page.route('**/api/import-resume',r=>r.fulfill({status:502,json:{error:'Could not read resume.'}}));
  const file={name:'resume.txt',mimeType:'text/plain',buffer:Buffer.from('Sam Lee')};
  await page.locator('#resume-file').setInputFiles(file);await expect(page.locator('#resume-import-status')).toContainText('Could not read');
  await expect(page.locator('[data-label="Email"]')).toHaveValue('kept@example.com');
  await page.unroute('**/api/import-resume');await page.route('**/api/import-resume',r=>r.fulfill({json:{fields}}));
  await page.locator('#resume-file').setInputFiles(file);await page.getByRole('button',{name:'Discard suggestions'}).click();await expect(page.locator('#applicant-info-name')).toHaveValue('');
  await page.locator('#resume-file').setInputFiles({name:'resume.exe',mimeType:'application/octet-stream',buffer:Buffer.from('x')});await expect(page.locator('#resume-import-status')).toContainText('Choose a PDF');
});
