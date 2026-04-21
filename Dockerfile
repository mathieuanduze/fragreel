FROM python:3.11-slim

# ── System deps ───────────────────────────────────────────────────────────────
# Node.js 20 para Remotion + Chrome deps (Chromium headless é baixado pelo Remotion)
# ffmpeg para reencoding e fontes para renderizar texto corretamente.
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
      gnupg \
      ffmpeg \
      fonts-liberation \
      fonts-noto-color-emoji \
      # Chromium deps (Remotion baixa Chrome headless, precisa dessas libs)
      libnss3 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libdrm2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libgbm1 \
      libasound2 \
      libpango-1.0-0 \
      libcairo2 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python deps ───────────────────────────────────────────────────────────────
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Editor (Remotion) deps ────────────────────────────────────────────────────
# Copiamos o package.json primeiro para cachear o npm install
COPY editor/package.json editor/package-lock.json* ./editor/
RUN cd editor && npm install --production=false && npm cache clean --force

# Pré-baixa o Chrome headless que o Remotion usa (evita cold start de 30s+ no primeiro render)
RUN cd editor && npx remotion browser ensure || true

# ── App code ──────────────────────────────────────────────────────────────────
COPY api/ ./api/
COPY editor/ ./editor/

WORKDIR /app/api

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
