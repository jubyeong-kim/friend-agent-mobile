# 시안 A(a.svg)로 앱 아이콘 · Android 적응형 아이콘 · 스플래시 그림을 만든다.
# 크롬을 화면 없이 띄워 SVG 를 그대로 찍고(배경 투명), 스플래시 그림은 기호에 맞춰 잘라 낸다.
# 사용법: python make_assets.py   (이 폴더에서, 결과는 ../../assets/)
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent.parent / "assets"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
src = (HERE / "a.svg").read_text(encoding="utf-8")

def only(svg: str, keep: str) -> str:
    """A_background 또는 A_foreground 묶음 하나만 남긴다."""
    drop = "A_foreground" if keep == "A_background" else "A_background"
    return re.sub(rf'<g id="{drop}">.*?\n  </g>\n', "", svg, flags=re.S)

def render(svg: str, out: Path, size: int = 1024) -> None:
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "x.svg"
        f.write_text(svg, encoding="utf-8")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        f"--window-size={size},{size}", "--default-background-color=00000000",
                        "--force-device-scale-factor=1", f"--screenshot={out}", f.as_uri()],
                       check=True, capture_output=True)
    im = Image.open(out)
    assert im.size == (size, size), f"{out.name} 크기 {im.size}"

render(src, ASSETS / "icon.png")                                        # 기본 아이콘(배경 + 기호)
render(only(src, "A_background"), ASSETS / "android-icon-background.png")  # 적응형 배경
render(only(src, "A_foreground"), ASSETS / "android-icon-foreground.png")  # 적응형 전경(투명 위 흰 기호)
render(only(src, "A_foreground"), ASSETS / "android-icon-monochrome.png")  # 단색판(모양만 쓰임)

# 스플래시: 흰 기호만, 둘레를 기호에 맞춰 자르고 여백 6% (app.json 의 imageWidth 로 크기를 정한다)
fg = Image.open(ASSETS / "android-icon-foreground.png").convert("RGBA")
x0, y0, x1, y1 = fg.getbbox()
pad = int(max(x1 - x0, y1 - y0) * 0.06)
side = max(x1 - x0, y1 - y0) + pad * 2
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
splash = Image.new("RGBA", (side, side), (0, 0, 0, 0))
splash.paste(fg.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)), (0, 0))
splash.save(ASSETS / "splash-icon.png")

for name in ["icon.png", "android-icon-background.png", "android-icon-foreground.png",
             "android-icon-monochrome.png", "splash-icon.png"]:
    im = Image.open(ASSETS / name)
    alpha = im.convert("RGBA").getchannel("A")
    print(f"{name}: {im.size} {im.mode} 투명 칸 {sum(1 for a in alpha.getdata() if a == 0) * 100 // (im.size[0] * im.size[1])}%")
print("기호 범위(1024 캔버스):", (x0, y0, x1, y1))
