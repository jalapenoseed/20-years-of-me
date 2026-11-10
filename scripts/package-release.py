"""Create a deterministic itch HTML5 archive from the static dist directory."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import argparse

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(root / 'releases' / '20-years-of-me-html5.zip'))
args = parser.parse_args()
dist = root / 'dist'
if not (dist / 'index.html').is_file():
    raise SystemExit('Run npm run build before packaging.')
output = Path(args.output).resolve()
if output.is_relative_to(dist):
    raise SystemExit('Release archive must be outside dist/.')
output.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(dist.rglob('*')):
        if not file.is_file():
            continue
        name = file.relative_to(dist).as_posix()
        info = ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, file.read_bytes(), compresslevel=9)
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert 'index.html' in archive.namelist()
print(output)
