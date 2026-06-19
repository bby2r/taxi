# Store Submission — план и порядок шагов

Папка `store-submission/` содержит все готовые тексты и чек-листы
для подачи в App Store и Google Play.

## Файлы в правильном порядке

| # | Файл | Зачем |
|---|---|---|
| 00 | this README | Старт |
| 01 | `demo-account.md` | Тестовый логин + инструкция ревьюеру |
| 02 | `descriptions-ru.md` | Русские тексты (title/short/long) |
| 03 | `descriptions-en.md` | English тексты |
| 04 | `screenshots-checklist.md` | Какие 8 скринов сделать |
| 05 | `permissions-justifications.md` | Обоснования для location/overlay/notifications |
| 06 | `data-safety-google.md` | Готовые ответы для Google Data Safety form |
| 07 | `content-rating.md` | Age rating вопросы |
| 08 | `keywords-and-tags.md` | Apple keywords |
| 09 | `icon-and-assets.md` | Иконка 1024×1024 + feature graphic |

## Порядок действий

### Шаг 1 — Зарегистрировать аккаунты (1-3 дня)
- [ ] **Apple Developer Program**: $99/год, https://developer.apple.com/programs/
  - Выбрать **Individual** (для ИП — без DUNS)
  - Верификация: ID, e-mail, phone
  - Получить **Team ID** (Membership → Account)
- [ ] **Google Play Console**: $25 одноразово, https://play.google.com/console/signup
  - Выбрать **Individual account** (для скорости)
  - Верификация: ID-документ

### Шаг 2 — Подготовить ассеты (1-2 дня)
- [ ] Master-иконка 1024×1024 PNG (файл 09)
- [ ] Feature graphic 1024×500 (Google Play)
- [ ] Сделать 8 скриншотов на устройстве (файл 04)
- [ ] Записать 30-сек видео с background-location (для Google driver-app)

### Шаг 3 — Подготовить тексты (готово)
Все тексты в файлах 02-08. Просто копируй в формы.

### Шаг 4 — Собрать iOS-билд (1 день)
- [ ] `cd mobile/apps/client && npx eas init` — получить projectId
- [ ] Заменить `YOUR_CLIENT_EAS_PROJECT_ID` в `app.json` на реальный
- [ ] То же для `apps/driver` (там уже стоит `6a367005-...`)
- [ ] `npx eas credentials` → iOS Distribution Certificate (EAS сделает сам)
- [ ] `npx eas build --platform ios --profile production`
- [ ] Ждать ~30 мин, получить `.ipa` URL

### Шаг 5 — Создать app в App Store Connect
- [ ] Создать новое приложение
- [ ] Bundle ID: `kg.aliftaxi.client`
- [ ] Заполнить App Information по файлу 02
- [ ] App Privacy форма по файлу 05 (Privacy Nutrition Label)
- [ ] Загрузить иконку + скриншоты + ipa через `eas submit --platform ios`
- [ ] Указать **Demo Account** в App Review Information по файлу 01
- [ ] Submit for review

### Шаг 6 — Создать app в Google Play Console
- [ ] Создать новое приложение
- [ ] Package name: `kg.aliftaxi.client`
- [ ] Загрузить AAB (есть в GitHub Actions последнего билда мастера —
      `alif-taxi-client-...-aab.zip`)
- [ ] Заполнить Store listing по файлам 02/03/04
- [ ] Data safety по файлу 06
- [ ] Content rating по файлу 07
- [ ] Sensitive permissions по файлу 05 (включая 30-сек видео для
      background-location у driver-app)
- [ ] Указать **Demo Account** в Internal access form по файлу 01
- [ ] Submit for review

### Шаг 7 — Дождаться review
- Apple: 24-48 ч обычно, до 7 дн в крайнем случае
- Google: 3-7 дн обычно, до 14 дн для нового аккаунта

### Шаг 8 — В случае reject
- Прочитать причину
- Исправить
- Re-submit (ещё 24-48 ч)

---

## Параллельно — две заявки (Client + Driver)

У нас **два отдельных приложения**:
- `kg.aliftaxi.client` — пассажирское
- `kg.aliftaxi.app` (driver) — водительское

**Стратегия**: подавай **сначала только клиентское**. Это проще,
меньше permissions, ниже risk of reject. Когда оно зайдёт — подавай
водительское (background-location, full-screen intent, overlay —
все трикки).

Иначе можешь спалить watcher Apple/Google review на проблемах
драйверского приложения и затормозить и клиента.
