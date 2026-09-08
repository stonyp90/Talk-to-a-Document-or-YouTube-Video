FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 AS lambda-adapter

# One image family is used locally and as the Lambda container base.
FROM node:22-bookworm-slim AS dependencies
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
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
COPY infrastructure/cdk/package.json infrastructure/cdk/package-lock.json ./infrastructure/cdk/
RUN npm ci --prefix infrastructure/cdk

FROM test-tools AS test
COPY . .
RUN NODE_ENV=production OPENAI_API_KEY=ci_canary_OPENAI_clearlyfakefixture_2026 AWS_SECRET_ACCESS_KEY=ci_canary_AWS_clearlyfakefixture_2026 npm run build
CMD ["node", "infrastructure/scripts/container-tests.mjs"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter
ENV PORT=3000
ENV AWS_LWA_PORT=3000
ENV AWS_LWA_READINESS_CHECK_PATH=/api/health
EXPOSE 3000
CMD ["node", "server.js"]
