import importlib.util
import json
import shutil
import tempfile
import unittest
import tomllib
from pathlib import Path

spec = importlib.util.spec_from_file_location('prepare', 'scripts/prepare-release.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


VERSION = tomllib.loads(Path('src-tauri/Cargo.toml').read_text())['package']['version']


class ReleaseVersionTests(unittest.TestCase):
    def test_tag_matches_manifest(self):
        self.assertEqual(prepare.validate(Path('.'), 'tag', f'v{VERSION}'), VERSION)

    def test_manual_branch_is_allowed(self):
        self.assertEqual(prepare.validate(Path('.'), 'branch', 'main'), VERSION)

    def test_wrong_tags_fail(self):
        for tag in ['v999999.0.0', 'v1.0', f'v{VERSION}-beta']:
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                prepare.validate(Path('.'), 'tag', tag)

    def test_new_version_requires_matching_config_and_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'src-tauri').mkdir()
            for name in ['Cargo.toml', 'Cargo.lock', 'tauri.conf.json']:
                shutil.copy(Path('src-tauri') / name, root / 'src-tauri' / name)
            path = root / 'src-tauri/Cargo.toml'
            path.write_text(path.read_text().replace(f'version = "{VERSION}"', 'version = "9.9.9"', 1))
            with self.assertRaisesRegex(ValueError, 'versions disagree'):
                prepare.validate(root, 'branch', 'main')


    def test_config_version_mismatch_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'src-tauri').mkdir()
            for name in ['Cargo.toml', 'Cargo.lock', 'tauri.conf.json']:
                shutil.copy(Path('src-tauri') / name, root / 'src-tauri' / name)
            (root / 'src-tauri/tauri.conf.json').write_text(json.dumps({'version': '999999.0.0'}))
            with self.assertRaises(ValueError):
                prepare.validate(root, 'tag', f'v{VERSION}')


if __name__ == '__main__':
    unittest.main()
