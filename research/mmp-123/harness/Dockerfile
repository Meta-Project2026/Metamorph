# MMP-123 disposable Linux harness: trusted orchestration only. It never runs
# candidate or reference code itself; those execute solely in the network-off,
# nonroot, read-only rootfs, resource-bounded workers that the unchanged
# verifier provisions. Manual-only; not a GitHub workflow and never dispatched.
FROM node:24-bookworm@sha256:e7add2a490bb17d97b485b8641bd88455fff7839ade0f5eba493c3508124d413

ARG DOCKER_CLI_VERSION=28.5.2
ARG DOCKER_CLI_SHA256=ea90cfd12e1eeb12aa1c971741adb8bd4ed88e2a574eaac13f5029a1dbc6300d

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL -o /tmp/docker.tgz \
      "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_CLI_VERSION}.tgz" \
    && echo "${DOCKER_CLI_SHA256}  /tmp/docker.tgz" | sha256sum -c - \
    && tar -xzf /tmp/docker.tgz --strip-components=1 -C /usr/local/bin docker/docker \
    && rm /tmp/docker.tgz \
    && git config --system --add safe.directory /repo \
    && npm install --global pnpm@11.25.0

COPY run-inner.sh /usr/local/bin/mmp123-run
COPY volume-guard.sh /usr/local/bin/volume-guard.sh
RUN chmod 0755 /usr/local/bin/mmp123-run /usr/local/bin/volume-guard.sh
WORKDIR /root
