const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const publish = require('../scripts/publish-release.cjs');

function fixture(t, existingRelease) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tele2local-release-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  fs.writeFileSync(path.join(directory,'Tele2Local_1.0.0_universal.dmg'),'mac fixture');
  fs.writeFileSync(path.join(directory,'Tele2Local_1.0.0_x64-setup.exe'),'windows fixture');
  const calls=[];
  const repos={
    listReleases: 'listReleases', listReleaseAssets: 'listReleaseAssets',
    createRelease: async args=>{calls.push(['create',args]);return {data:{id:42,draft:true,html_url:'https://example.test/draft'}};},
    deleteReleaseAsset: async args=>calls.push(['delete',args]),
    uploadReleaseAsset: async args=>calls.push(['upload',args]),
  };
  return {directory,calls,context:{repo:{owner:'test',repo:'test'},ref:'refs/tags/v1.0.0',sha:'abc'},
    core:{info(){}},github:{rest:{repos},paginate:async method=>method==='listReleases'?(existingRelease?[existingRelease]:[]):[]}};
}
process.env.RELEASE_VERSION='1.0.0';

test('both installers produce one draft and matching checksums',async t=>{
  const f=fixture(t);await publish(f);
  assert.equal(f.calls.filter(([type])=>type==='create').length,1);
  assert.equal(f.calls.find(([type])=>type==='create')[1].draft,true);
  assert.equal(f.calls.filter(([type])=>type==='upload').length,3);
  assert.match(fs.readFileSync(path.join(f.directory,'SHA256SUMS.txt'),'utf8'),/^[a-f0-9]{64}  Tele2Local_1.0.0_universal.dmg/m);
});
test('missing platform installer prevents release creation',async t=>{
  const f=fixture(t);fs.unlinkSync(path.join(f.directory,'Tele2Local_1.0.0_x64-setup.exe'));
  await assert.rejects(publish(f),/Expected exactly/);assert.equal(f.calls.length,0);
});
test('published releases cannot be overwritten by a rerun',async t=>{
  const f=fixture(t,{id:1,tag_name:'v1.0.0',draft:false});
  await assert.rejects(publish(f),/already published/);assert.equal(f.calls.length,0);
});
test('a draft rerun reuses the release rather than creating another',async t=>{
  const f=fixture(t,{id:1,tag_name:'v1.0.0',draft:true,html_url:'https://example.test/draft'});
  await publish(f);assert.equal(f.calls.filter(([type])=>type==='create').length,0);
  assert.equal(f.calls.filter(([type])=>type==='upload').length,3);
});
test('incorrect tag cannot publish',async t=>{
  const f=fixture(t);f.context.ref='refs/tags/v2.0.0';
  await assert.rejects(publish(f),/tag does not match/);assert.equal(f.calls.length,0);
});
