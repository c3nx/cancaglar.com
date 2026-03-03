FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --production

COPY . .

RUN mkdir -p data uploads/images uploads/videos

EXPOSE 3000

CMD ["bun", "run", "server.ts"]
