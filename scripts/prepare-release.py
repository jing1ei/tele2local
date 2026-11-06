"""Check the release identity before any platform build starts."""
import json
import os
import re
import tomllib
from pathlib import Path


def validate(root, ref_type, ref_name):
    manifest = tomllib.loads((root / 'src-tauri/Cargo.toml').read_text())
    version = manifest['package']['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Release version must be MAJOR.MINOR.PATCH')
    if version != '1.0.0':
        raise ValueError('The rolling release contract requires version 1.0.0')
    config = json.loads((root / 'src-tauri/tauri.conf.json').read_text())
    if config.get('version', version) != version:
        raise ValueError('Tauri and Cargo versions disagree')
    lock = tomllib.loads((root / 'src-tauri/Cargo.lock').read_text())
    if not any(p['name'] == manifest['package']['name'] and p['version'] == version
               for p in lock['package']):
        raise ValueError('Cargo.lock does not match the application version')
    if ref_type == 'tag' and ref_name != f'v{version}':
        raise ValueError(f'Tag must be v{version}, received {ref_name}')
    return version


if __name__ == '__main__':
    version = validate(Path('.'), os.environ.get('GITHUB_REF_TYPE'),
                       os.environ.get('GITHUB_REF_NAME'))
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write(f'version={version}\n')
    print(f'Validated Tele2Local {version}')
