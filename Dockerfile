FROM node:18-alpine

WORKDIR /app

# Копируем package файлы для лучшего кеширования
COPY package*.json ./
COPY tsconfig.json ./
COPY knexfile.ts ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY src/ ./src/

# Создаем необходимые папки
RUN mkdir -p dist

# Устанавливаем переменные окружения для ts-node
ENV NODE_ENV=development
ENV TS_NODE_TRANSPILE_ONLY=true

# Запускаем миграции и приложение
CMD sh -c "npx knex migrate:latest && npx ts-node src/app.ts"