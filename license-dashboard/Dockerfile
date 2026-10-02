FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3200 DATA_DIR=/app/data
COPY --chown=node:node package.json server.mjs issuer.mjs ./
COPY --chown=node:node public ./public
COPY --chown=node:node tools/backup.mjs ./tools/backup.mjs
RUN mkdir -p /app/data && chown node:node /app/data && chmod 700 /app/data
USER node
EXPOSE 3200
CMD ["node", "server.mjs"]
