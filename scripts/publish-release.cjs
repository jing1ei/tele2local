const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Invoked once, after both platform artifacts are available.
module.exports = async ({github, context, core, directory = 'release-assets'}) => {
  const version = process.env.RELEASE_VERSION;
  if (!/^\d+\.\d+\.\d+$/.test(version || '') || context.ref !== `refs/tags/v${version}`) {
    throw new Error('Release tag does not match the validated app version');
  }
  const files = fs.readdirSync(directory).sort();
  const dmg = files.filter(name => name.endsWith('.dmg'));
  const exe = files.filter(name => name.endsWith('-setup.exe'));
  if (dmg.length !== 1 || exe.length !== 1 || files.length !== 2 ||
      !dmg[0].includes(`_${version}_universal`) || !exe[0].includes(`_${version}_x64`)) {
    throw new Error('Expected exactly one version-matched universal DMG and x64 Windows installer');
  }
  for (const name of files) {
    if (!fs.statSync(path.join(directory, name)).size) throw new Error(`Empty artifact: ${name}`);
  }
  const checksums = files.map(name => {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex');
    return `${hash}  ${name}\n`;
  }).join('');
  fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), checksums);
  const repo = context.repo;
  const tag = `v${version}`;
  const releases = await github.paginate(github.rest.repos.listReleases, {...repo, per_page: 100});
  let release = releases.find(item => item.tag_name === tag);
  if (release && !release.draft) throw new Error(`Release ${tag} is already published; refusing to replace its assets`);
  if (!release) {
    release = (await github.rest.repos.createRelease({
      ...repo, tag_name: tag, target_commitish: context.sha,
      name: `Tele2Local ${tag}`, draft: true, prerelease: false,
      body: 'macOS 11+: universal Intel/Apple Silicon DMG. Windows 10/11 x64: setup executable.\n\nWindows setup downloads WebView2 if needed. These builds are unsigned.\n\nFor a trusted macOS download, after moving the app to Applications:\n\n```sh\nxattr -dr com.apple.quarantine /Applications/Tele2Local.app\n```\n\nSHA256SUMS.txt contains the installer checksums.',
    })).data;
  }
  const existing = await github.paginate(github.rest.repos.listReleaseAssets, {...repo, release_id: release.id, per_page: 100});
  for (const name of [...files, 'SHA256SUMS.txt']) {
    const old = existing.find(asset => asset.name === name);
    if (old) await github.rest.repos.deleteReleaseAsset({...repo, asset_id: old.id});
    const data = fs.readFileSync(path.join(directory, name));
    await github.rest.repos.uploadReleaseAsset({
      ...repo, release_id: release.id, name, data,
      headers: {'content-type': 'application/octet-stream', 'content-length': data.length},
    });
  }
  core.info(`Draft ready for review: ${release.html_url}`);
};
