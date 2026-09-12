FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 AS lambda-adapter

# One image family is used locally and as the Lambda container base.
FROM node:22-bookworm-slim AS dependencies
ARG OBJECT_STORE_PUBLIC_ENDPOINT
# What the paid plan costs and where it is bought. Public values, inlined into
# the browser bundle at build time; empty means billing is not open yet.
ARG NEXT_PUBLIC_PAID_PLAN_PRICE
ARG NEXT_PUBLIC_PAID_PLAN_URL
# The pages, the sitemap and the plain-text reading are prerendered, so what
# the site says about itself is fixed when the image is built, not when it runs.
ARG SITE_URL
ARG SITE_SAME_AS
ARG INTRO_VIDEO_YOUTUBE_ID_EN
ARG INTRO_VIDEO_YOUTUBE_ID_FR
ENV NODE_ENV=production
ENV OBJECT_STORE_PUBLIC_ENDPOINT=${OBJECT_STORE_PUBLIC_ENDPOINT}
ENV NEXT_PUBLIC_PAID_PLAN_PRICE=${NEXT_PUBLIC_PAID_PLAN_PRICE}
ENV NEXT_PUBLIC_PAID_PLAN_URL=${NEXT_PUBLIC_PAID_PLAN_URL}
ENV SITE_URL=${SITE_URL}
ENV SITE_SAME_AS=${SITE_SAME_AS}
ENV INTRO_VIDEO_YOUTUBE_ID_EN=${INTRO_VIDEO_YOUTUBE_ID_EN}
ENV INTRO_VIDEO_YOUTUBE_ID_FR=${INTRO_VIDEO_YOUTUBE_ID_FR}
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/adapters/package.json ./packages/adapters/
RUN npm ci --include=dev

FROM dependencies AS builder
COPY . .
RUN npm run build

FROM dependencies AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM dependencies AS test-tools
ENV NODE_ENV=development
RUN npx playwright install --with-deps chromium

FROM test-tools AS test
COPY . .
RUN NODE_ENV=production OPENAI_API_KEY=ci_canary_OPENAI_clearlyfakefixture_2026 AWS_SECRET_ACCESS_KEY=ci_canary_AWS_clearlyfakefixture_2026 npm run build
CMD ["node", "infrastructure/scripts/container-tests.mjs"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
WORKDIR /app/apps/web
COPY --from=lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter
ENV PORT=3000
ENV AWS_LWA_PORT=3000
ENV AWS_LWA_READINESS_CHECK_PATH=/api/health
EXPOSE 3000
CMD ["node", "server.js"]
