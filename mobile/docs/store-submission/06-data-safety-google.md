# Google Play — Data Safety Form

В Play Console → **App content → Data safety** заполняется в виде формы.
Ниже — готовые ответы, скопируй в соответствующие поля.

## Q1: Does your app collect or share any required user data types?

**Answer:** ✅ Yes

## Q2: Is all of the user data collected by your app encrypted in transit?

**Answer:** ✅ Yes (HTTPS/TLS 1.2+ для всех API + Pusher WebSocket — WSS)

## Q3: Do you provide a way for users to request that their data be deleted?

**Answer:** ✅ Yes
- В приложении: ProfileScreen → Logout
- По запросу: WhatsApp +996 509 397 226 или email
- Server-side: 30-дневный TTL после удаления аккаунта

---

## Data Types Collected

Отметить ОДНИМ блоком в форме:

### Personal info
- **Name**
  - Collected: ✅ Yes
  - Optional: ❌ Required
  - Shared with 3rd parties: ❌ No
  - Purpose: App functionality (отображение водителю)

- **Phone number**
  - Collected: ✅ Yes
  - Optional: ❌ Required
  - Shared: ❌ No
  - Purpose: App functionality (вход через SMS-код), Account management

### Photos and videos
- **Photos**
  - Collected: ✅ Yes (только водительские фото-профиля)
  - Optional: ✅ Optional (для клиентов — не собираем фото; для водителей — фото профиля)
  - Shared: ❌ No
  - Purpose: App functionality (фото водителя для клиента)

### Location
- **Approximate location**
  - Collected: ✅ Yes
  - Optional: ❌ Required
  - Shared: ❌ No
  - Purpose: App functionality (определение села для тарифа)

- **Precise location**
  - Collected: ✅ Yes
  - Optional: ❌ Required
  - Shared: ❌ No
  - Purpose: App functionality (точка подачи такси / отправка водителю
    координат для дисптача)

### Financial info
- **Purchase history**
  - Collected: ✅ Yes (сумма заказа, дата)
  - Optional: ❌ Required
  - Shared: ❌ No
  - Purpose: App functionality (история поездок), Account management

### Personal identifiers
- **User IDs**
  - Collected: ✅ Yes
  - Optional: ❌ Required
  - Shared: ❌ No
  - Purpose: App functionality (внутренний user_id для idempotency)

### App activity
- **App interactions**
  - Collected: ✅ Yes (история заказов, оценки)
  - Optional: ❌ Required
  - Shared: ❌ No
  - Purpose: App functionality

---

## Что НЕ собираем (важно отметить «No» в форме чтобы Google не подозревал)

- ❌ Email или почтовые адреса
- ❌ Address (домашний адрес — мы знаем только точки A/B на момент заказа, не postal address)
- ❌ Race/ethnicity, sexual orientation, religious beliefs, political views
- ❌ Health, fitness data
- ❌ Contacts (телефонная книга)
- ❌ Calendar events, SMS messages
- ❌ Web browsing history
- ❌ Audio/voice recordings
- ❌ Files and docs (кроме фото профиля водителя)
- ❌ Crash logs / performance metrics с PII

---

## Privacy policy URL

**Ввести в форме**:
```
https://taxi-api-cy7a.onrender.com/privacy
```
