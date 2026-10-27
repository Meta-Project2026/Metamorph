FROM node:24.11.0-bookworm-slim@sha256:76d0ed0ed93bed4f4376211e9d8fddac4d8b3fbdb54cc45955696001a3c91152
ENV NODE_ENV=production TZ=UTC
WORKDIR /opt/toolchain
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund --omit=optional \
    && apt-get update \
    && apt-get install -y --no-install-recommends libfaketime=0.9.10-2 \
    && rm -rf /var/lib/apt/lists/* /root/.npm \
    && mkdir -p /state /work /opt/worker \
    && chown 10001:10001 /state /work
COPY *.mjs /opt/worker/
USER 10001:10001
WORKDIR /work
CMD ["sleep", "240"]
