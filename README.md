# MAX Gemini TTS Bot

Голосовой бот для мессенджера **MAX**: любой текст → аудио через **Gemini 3.1 Flash TTS Preview**.  
Serverless на **Vercel**, настройки пользователя в **Vercel KV**.

## Возможности

- Озвучка текста (до 4000 символов)
- **30 голосов** Gemini TTS (Sulafat, Algenib, Kore, Puck и др.)
- **Стиль и темп** — как Director's note в AI Studio
- **Сцена и контекст** — настроение и подача речи
- Свои сцена/контекст: `/scene` и `/context`
- Inline-меню в MAX

## Структура

```
api/
  webhook.js          # точка входа webhook
  health.js           # проверка конфигурации
lib/
  config.js           # лимиты, пресеты, модель
  voices.js           # 30 голосов Gemini
  router.js
  handlers/           # команды, кнопки, TTS
  max/                # клиент MAX, загрузка audio
  tts/gemini.js       # Gemini TTS API
  storage/            # настройки (KV)
  texts/messages.js   # тексты и клавиатуры
```

## Быстрый деплой

### 1. Токены

**Google AI Studio:** [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → `GEMINI_API_KEY`.

**MAX:** [dev.max.ru](https://dev.max.ru) → бот → `MAX_BOT_TOKEN`.

### 2. Vercel

```bash
cd Voice2botGemini
npm install
npx vercel --prod
```

Переменные в Vercel → Settings → Environment Variables:

| Переменная | Обязательно |
|---|---|
| `GEMINI_API_KEY` | да |
| `MAX_BOT_TOKEN` | да |
| `MAX_WEBHOOK_SECRET` | рекомендуется |

Подключите **Vercel KV** и передеплойте.

### 3. Webhook MAX

```powershell
.\scripts\subscribe-webhook.ps1 `
  -Token "YOUR_MAX_BOT_TOKEN" `
  -WebhookUrl "https://YOUR_APP.vercel.app/api/webhook" `
  -Secret "YOUR_RANDOM_SECRET"
```

### 4. Проверка

- `GET https://YOUR_APP.vercel.app/api/health`
- В MAX: `/start` → меню
- Отправьте текст → аудио

## Команды

| Команда | Действие |
|---|---|
| `/start` | приветствие и меню |
| `/voice` | выбор голоса (30, постранично) |
| `/settings` | сводка настроек |
| `/scene текст` | своя сцена |
| `/context текст` | свой контекст доставки |
| `/help` | справка |

## Голоса Gemini TTS

Полный список — 30 имён в `lib/voices.js` (Zephyr, Puck, Kore, Sulafat, Algenib, …).  
По умолчанию: **Sulafat** (Warm).

## Промпт озвучки

Бот собирает запрос как в AI Studio:

- **Director's note** — стиль и темп
- **Scene** — обстановка
- **Sample Context** — как подаётся речь
- **Transcript** — ваш текст

Пример настроек из скриншота: сцена «Яркий летний день», контекст «Друг рассказывает историю», голос Algenib.

## Загрузка в новый репозиторий

```bash
cd Voice2botGemini
git init
git add .
git commit -m "Initial commit: MAX bot with Gemini 3.1 Flash TTS"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```
