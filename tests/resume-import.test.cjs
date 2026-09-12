const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resumeInput, validateResumeFields, fields } = require('../server/resume-import.cjs');
const blank = () => Object.fromEntries(fields.map(key => [key, '']));
test('resume imports enforce file types, signatures and size before provider calls', () => {
  assert.throws(() => resumeInput({name:'resume.exe',data:'YQ=='}), /PDF/);
  assert.throws(() => resumeInput({name:'resume.pdf',data:'YQ=='}), /readable PDF/);
  assert.throws(() => resumeInput({name:'resume.txt',data:'!invalid'}), /encoding/);
  assert.throws(() => resumeInput({name:'resume.txt',data:Buffer.alloc(100001,65).toString('base64')}), /100 KB/);
  assert.equal(resumeInput({name:'resume.txt',data:Buffer.from('Sam Lee').toString('base64')}).source, 'Sam Lee');
});
test('resume fields retain source text and reject fabricated text or malformed types', () => {
  const value = {...blank(),Name:'Sam Lee',Email:'sam@example.com'};
  assert.equal(validateResumeFields(value,'Sam Lee\nEmail: sam@example.com').Name,'Sam Lee');
  assert.throws(() => validateResumeFields({...value,Education:'PhD'},'Sam Lee\nEmail: sam@example.com'), /not found/);
  assert.throws(() => validateResumeFields({...value,Name:{}}), /Invalid Name/);
});
