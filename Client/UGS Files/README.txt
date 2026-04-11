Git LFS — why you might see "version https://git-lfs.github.com/spec/v1"

1) On github.com when you open a game file in the browser, GitHub often shows the
   POINTER text, not the real HTML. That is normal. Use the file's "Download" button,
   or clone the repo with Git LFS (see below).

2) If you used "Code -> Download ZIP" on GitHub, ZIP archives do NOT include LFS
   files — you only get pointers. Clone with Git instead.

3) After clone, always run:
   git lfs install
   git lfs pull

4) Fresh clone with LFS in one step:
   git clone <repo-url>
   cd FluxyV3
   git lfs install
   git lfs pull
