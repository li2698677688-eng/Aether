FROM mcr.microsoft.com/playwright:v1.56.1-jammy

ARG DITTO_REVISION=3860a1a3a340069eabbfc550fd49807dd10f4f2c

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/ditto

# Fetch one immutable, audited upstream revision instead of following main.
RUN git init \
  && git remote add origin https://github.com/ion-design/ditto.site.git \
  && git fetch --depth=1 origin "${DITTO_REVISION}" \
  && git checkout --detach FETCH_HEAD \
  && test "$(git rev-parse HEAD)" = "${DITTO_REVISION}"

# Keep the compiler algorithm pinned while closing advisories discovered after
# the upstream revision was published. The patch also updates package-lock.json.
COPY upstream-security.patch /tmp/upstream-security.patch
RUN git apply --check /tmp/upstream-security.patch \
  && git apply /tmp/upstream-security.patch \
  && npm ci \
  && npm audit --omit=dev --audit-level=high

RUN mkdir -p /data/artifacts /data/capture-cache /data/harness

ENV PORT=8787 \
  ARTIFACTS_DIR=/data/artifacts \
  CAPTURE_CACHE_DIR=/data/capture-cache \
  CLONE_TTL_MS=1800000 \
  RATE_LIMIT_PER_MINUTE=60

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "run", "start", "--workspace", "@cloner/api"]
