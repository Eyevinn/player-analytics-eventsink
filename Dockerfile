# syntax=docker/dockerfile:1.2
ARG NODE_IMAGE=node:18-alpine

FROM ${NODE_IMAGE}
ENV NODE_ENV=production
EXPOSE 8080
RUN mkdir /app
RUN chown node:node /app
WORKDIR /app
COPY --chown=node:node . .
# Delete prepare script to avoid errors from husky
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm pkg delete scripts.prepare \
    && npm ci --omit=dev
USER node
ENV QUEUE_TYPE=SQS
ENV AWS_REGION=dummy
CMD [ "npm", "run", "start" ]