# The tag must match @playwright/test in package.json.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

# The official image ships no Arabic- or Hebrew-specific fonts (docs/CHECKER_SPEC.md §7).
# Its generic fonts already satisfy a bare `fc-list :lang=ar`, so the check requires Noto faces.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-noto-core fonts-noto-mono \
 && rm -rf /var/lib/apt/lists/*
RUN fc-list :lang=ar family | grep -qi noto || { echo 'No Noto font covers Arabic' >&2; exit 1; }; \
    fc-list :lang=he family | grep -qi noto || { echo 'No Noto font covers Hebrew' >&2; exit 1; }; \
    echo "Noto faces: ar=$(fc-list :lang=ar | grep -ci noto) he=$(fc-list :lang=he | grep -ci noto)"

ENV TZ=UTC
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# shortcut: runs as root, so Chromium's sandbox is off (fine for our own pages per the Playwright
# Docker docs); switch to pwuser + seccomp_profile.json before auditing third-party UIs (Phase 3).
CMD ["npx", "playwright", "test"]
