FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV QEDIX_DEPLOY_ENV=production
ENV QEDIX_EXPECTED_RISK="production container has no Docker HEALTHCHECK"

RUN echo "Qedix Area 27.7 Missing healthcheck canary" > /app/qedix-area-27-healthcheck.txt

# BUG: production container starts the app but does not define HEALTHCHECK.
# Expected review: Missing healthcheck / no liveness-readiness check.
CMD ["node", "-e", "console.log('Qedix Area 27.7 missing healthcheck canary')"]
