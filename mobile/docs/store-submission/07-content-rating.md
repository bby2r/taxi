# Content Rating ответы

## Apple App Store — Age Rating

В App Store Connect → App Information → Age Rating заполняется анкета.
Все ответы:

| Категория | Ответ |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, or Drug Use or References | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Prolonged Graphic or Sadistic Realistic Violence | None |
| Graphic Sexual Content and Nudity | None |
| Unrestricted Web Access | **No** (наш app только наш собственный API + Pusher) |
| Gambling and Contests | None |
| Medical/Treatment Information | No |
| Restricted Access | No |

**Result: Age Rating 4+**

---

## Google Play — IARC Rating Questionnaire

В Play Console → App content → Content rating нужно заполнить IARC анкету.
Категория приложения: **Reference, News, or Educational** или **Business**
(такси — это Business / Maps & Navigation).

Все вопросы:

- Violence: **No**
- Sexual content: **No**
- Profanity: **No**
- Controlled substances: **No**
- Gambling: **No**
- User-generated content: **No** (только рейтинги водителей — это не UGC в смысле IARC, потому что мы их модерируем)
- Social features: **No** (no chats / messaging внутри приложения)
- Personal info sharing: **No** (клиент видит только имя+фото водителя — это functional, не social)
- Digital purchases: **No**
- Mini-games: **No**
- Unrestricted internet: **No**
- Location sharing with third parties: **No**

**Result: Everyone**

---

## Target audience

В Play Console → App content → Target audience and content:
- **Target age groups**: 18+
- (не для детей — такси-приложение требует кредитные карты / документы взрослого; технически у нас наличный расчёт, но всё равно сервис не предназначен для несовершеннолетних)

---

## Apple App Store Category

Primary: **Travel**
Secondary: **Navigation** (опционально)

## Google Play Category

Primary: **Maps & Navigation**
(альтернатива: **Travel & Local** — оба валидны)
